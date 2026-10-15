from fastapi import FastAPI, APIRouter, HTTPException, Response
from starlette.concurrency import run_in_threadpool
import base64
import requests
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import re
import json
import uuid
import logging
from pathlib import Path
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from typing import List, Optional, Annotated, Any
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

app = FastAPI()
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# --- Emergent object storage (drawing photos) ---
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "docinki-pro"
storage_key = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global storage_key
    for attempt in range(2):
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
        if resp.status_code == 503 and attempt == 0:
            storage_key = None
            continue
        resp.raise_for_status()
        return resp.json()


def get_object(path: str):
    global storage_key
    for attempt in range(2):
        key = init_storage()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
        if resp.status_code == 503 and attempt == 0:
            storage_key = None
            continue
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "image/jpeg")


PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude={"id"})
        return data

    @classmethod
    def from_mongo(cls, doc: dict):
        return cls.model_validate(doc)


class Opening(BaseModel):
    x: float
    y: float
    width: float
    height: float


class WallDims(BaseModel):
    name: str = ""
    length: float
    height: float
    thickness: float = 14
    openings: List[Opening] = []
    project: str = ""
    photo_path: str = ""
    topMode: Optional[str] = None  # legacy, ignored
    topVariant: Optional[str] = None
    kimlaga: Optional[bool] = None
    allowBrick: Optional[bool] = None


class WallCreate(WallDims):
    settings: dict
    result: dict


class Wall(BaseDocument, WallCreate):
    created_at: str


class AnalyzeRequest(BaseModel):
    image_base64: str


class AnalyzeResponse(BaseModel):
    name: str
    length: Optional[float]
    height: Optional[float]
    thickness: Optional[float]
    openings: List[Opening]
    notes: str
    photo_path: str = ""
    kimlaga: bool = False


class ProjectRename(BaseModel):
    ids: List[str]
    project: str


SYSTEM_PROMPT = """You read shop drawings of prefabricated masonry (clay block) walls, e.g. from FF Products / 'WAND CONTROLE' sheets.
The photo may be rotated (90/180 degrees), tilted or partially covered. Dimensions are in centimeters.
The sheet usually shows the wall FRONT VIEW (a rectangle with brick pattern), plus top/side views as thin strips.
Thin strip dimension (e.g. 14) is the wall THICKNESS. The front view horizontal dimension is the LENGTH and vertical is the HEIGHT.
Ignore absolute level markers like '1199.0 cm' or '1500.0 cm' - those are elevations, not wall size.
Element number is the big 'Elementnr' text in the title block bottom-right (e.g. 'F1-14402', 'A14309', 'B1...'), NOT the 'Ordernummer' (BR...). HEIGHT is the full wall height (e.g. 266), not a partial dimension like 259.
Openings: windows/doors/recesses AND notches cut out of the wall edges (e.g. at the top corners the front view is 17 wide lower: 259 instead of 266, so a notch x=0, y=259, width=17, height=7; the right one x=length-17).
For every opening give x from the left edge, y from the bottom, width and height in cm.
KIMLAGA: a hatched (cross-hatched) strip along one edge, usually marked 'KIM' with its width (e.g. 21), is the KIMLAGA = the FIRST masonry course.
It is NOT an opening - never put it in openings. Then set "kimlaga": true and orient the wall by the masonry direction:
HEIGHT = the dimension measured from the kimlaga strip to the opposite edge (incl. the strip, e.g. 268), LENGTH = the dimension along the strip (e.g. 205).
Generally courses are stacked in the HEIGHT direction (block joints show the courses); without kimlaga use the normal front view orientation and "kimlaga": false.
Respond ONLY with JSON, no markdown:
{"name": "<element number or empty>", "length": <number|null>, "height": <number|null>, "thickness": <number|null>, "kimlaga": <true|false>, "openings": [{"x":..,"y":..,"width":..,"height":..}], "notes": "<short note in Polish about what you read / uncertainty>"}"""


def parse_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("no json")
    return json.loads(m.group(0))


@api_router.get("/")
async def root():
    return {"message": "Docinki Pro API"}


@api_router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    b64 = req.image_base64.split(",", 1)[-1]
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"analyze-{uuid.uuid4()}", system_message=SYSTEM_PROMPT) \
        .with_model("gemini", "gemini-3-flash-preview")
    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(
            text="Odczytaj wymiary ściany z tego rysunku i zwróć JSON.",
            file_contents=[ImageContent(image_base64=b64)],
        )):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        data = parse_json(text)
    except Exception as e:
        logger.exception("analyze failed: %s | %s", e, text[:500])
        raise HTTPException(status_code=502, detail="Nie udało się odczytać rysunku")

    photo_path = await store_photo(b64)

    def num(v: Any):
        try:
            return float(str(v).replace(",", ".")) if v is not None else None
        except ValueError:
            return None

    openings = []
    for o in data.get("openings") or []:
        vals = [num(o.get(k)) for k in ("x", "y", "width", "height")]
        if all(v is not None for v in vals):
            openings.append(Opening(x=vals[0], y=vals[1], width=vals[2], height=vals[3]))
    return AnalyzeResponse(
        name=str(data.get("name") or ""),
        length=num(data.get("length")),
        height=num(data.get("height")),
        thickness=num(data.get("thickness")),
        openings=openings,
        notes=str(data.get("notes") or ""),
        photo_path=photo_path,
        kimlaga=bool(data.get("kimlaga")),
    )


async def store_photo(b64: str) -> str:
    """Save the drawing photo; returns storage path or '' when storage is unavailable."""
    try:
        data = base64.b64decode(b64)
        path = f"{APP_NAME}/uploads/drawings/{uuid.uuid4()}.jpg"
        res = await run_in_threadpool(put_object, path, data, "image/jpeg")
        stored = res.get("path", path)
        await db.files.insert_one({"storage_path": stored, "content_type": "image/jpeg", "size": len(data),
                                   "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat()})
        return stored
    except Exception as e:
        logger.exception("photo store failed: %s", e)
        return ""


@api_router.get("/files/{path:path}")
async def get_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="Nie znaleziono")
    try:
        data, ct = await run_in_threadpool(get_object, path)
    except Exception as e:
        logger.exception("photo read failed: %s", e)
        raise HTTPException(status_code=502, detail="Błąd odczytu zdjęcia")
    return Response(content=data, media_type=rec.get("content_type", ct), headers={"Cache-Control": "public, max-age=86400"})


@api_router.patch("/walls/project")
async def rename_project(body: ProjectRename):
    ids = [ObjectId(i) for i in body.ids if ObjectId.is_valid(i)]
    res = await db.walls.update_many({"_id": {"$in": ids}}, {"$set": {"project": body.project.strip()}})
    return {"updated": res.modified_count}


@api_router.post("/walls", response_model=Wall, response_model_by_alias=False)
async def create_wall(body: WallCreate):
    wall = Wall(**body.model_dump(), created_at=datetime.now(timezone.utc).isoformat())
    res = await db.walls.insert_one(wall.to_mongo())
    wall.id = str(res.inserted_id)
    return wall


@api_router.get("/walls", response_model=List[Wall], response_model_by_alias=False)
async def list_walls():
    docs = await db.walls.find().sort("created_at", -1).to_list(500)
    return [Wall.from_mongo(d) for d in docs]


def oid(wall_id: str) -> ObjectId:
    if not ObjectId.is_valid(wall_id):
        raise HTTPException(status_code=404, detail="Nie znaleziono")
    return ObjectId(wall_id)


@api_router.get("/walls/{wall_id}", response_model=Wall, response_model_by_alias=False)
async def get_wall(wall_id: str):
    doc = await db.walls.find_one({"_id": oid(wall_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Nie znaleziono")
    return Wall.from_mongo(doc)


@api_router.delete("/walls/{wall_id}")
async def delete_wall(wall_id: str):
    res = await db.walls.delete_one({"_id": oid(wall_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Nie znaleziono")
    return {"ok": True}


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup_storage():
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.error("storage init failed: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
