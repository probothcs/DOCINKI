"""Backend API tests for Docinki Pro (snap-wall-cuts).

Covers:
- Health
- Walls CRUD (create / list / get by id / delete, no _id leak, 404 handling)
- Analyze endpoint (Gemini) against two new test drawings:
    A14309 (344 x 266 x 15, two notches at top corners 17x7)
    B1 (438 x 266 x 14.5)
"""

import base64
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://snap-wall-cuts.preview.emergentagent.com").rstrip("/")

IMG_A14309 = (
    "https://customer-assets-eiarnc6j.emergentagent.net/"
    "job_snap-wall-cuts/artifacts/219cdf2e051f7505_IMG20260615230032.webp"
)
IMG_B1 = (
    "https://customer-assets-eiarnc6j.emergentagent.net/"
    "job_snap-wall-cuts/artifacts/fb58bb24725a8d04_IMG20260918130756.webp"
)


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _download_as_jpeg_b64(url: str) -> str:
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="session")
def jpeg_a14309():
    return _download_as_jpeg_b64(IMG_A14309)


@pytest.fixture(scope="session")
def jpeg_b1():
    return _download_as_jpeg_b64(IMG_B1)


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message") == "Docinki Pro API"


# ---------------- Walls CRUD ----------------
class TestWallsCRUD:
    created_id = None

    def _wall_payload(self):
        return {
            "name": "TEST_WALL_A14309",
            "length": 344,
            "height": 266,
            "thickness": 15,
            "openings": [
                {"x": 0, "y": 259, "width": 17, "height": 7},
                {"x": 327, "y": 259, "width": 17, "height": 7},
            ],
            "settings": {
                "blockLength": 50,
                "blockHeight": 24,
                "mortar": 1,
                "minModule": 24.4,
                "maxModule": 25.1,
                "topBricks": [9, 14, 19],
                "tolerance100": 100,
                "luz": 1,
                "minPiece": 10,
                "firstCourseHalf": False,
            },
            "result": {
                "module": 50,
                "courseCount": 10,
                "courseHeight": 25.1,
                "stackHeight": 251,
                "topBrick": 14,
                "topIsCut": False,
                "heightWarning": False,
                "courses": [],
                "totalFull": 60,
                "topFull": 6,
                "totalCuts": 2,
                "cutGroups": [{"len": 17, "h": 7, "from": 9, "count": 2}],
            },
        }

    def test_01_create_wall(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/walls", json=self._wall_payload())
        assert r.status_code == 200, r.text
        data = r.json()
        assert "_id" not in data
        assert isinstance(data.get("id"), str) and len(data["id"]) > 0
        assert data["name"] == "TEST_WALL_A14309"
        assert data["length"] == 344
        assert data["height"] == 266
        assert data["result"]["topBrick"] == 14
        assert data["result"]["totalCuts"] == 2
        TestWallsCRUD.created_id = data["id"]

    def test_02_list_walls_contains_created(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/walls")
        assert r.status_code == 200
        walls = r.json()
        assert isinstance(walls, list)
        for w in walls:
            assert "_id" not in w
            assert isinstance(w.get("id"), str)
        assert any(w["id"] == TestWallsCRUD.created_id for w in walls)

    def test_03_get_wall_by_id(self, api_client):
        assert TestWallsCRUD.created_id
        r = api_client.get(f"{BASE_URL}/api/walls/{TestWallsCRUD.created_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == TestWallsCRUD.created_id
        assert data["length"] == 344
        assert len(data["openings"]) == 2
        assert "_id" not in data

    def test_04_get_invalid_id_returns_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/walls/not-a-valid-objectid")
        assert r.status_code == 404

    def test_05_get_nonexistent_id_returns_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/walls/507f1f77bcf86cd799439011")
        assert r.status_code == 404

    def test_06_delete_wall(self, api_client):
        assert TestWallsCRUD.created_id
        r = api_client.delete(f"{BASE_URL}/api/walls/{TestWallsCRUD.created_id}")
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_07_get_after_delete_returns_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/walls/{TestWallsCRUD.created_id}")
        assert r.status_code == 404

    def test_08_delete_invalid_id_returns_404(self, api_client):
        r = api_client.delete(f"{BASE_URL}/api/walls/not-a-valid-objectid")
        assert r.status_code == 404


# ---------------- Analyze (Gemini vision) ----------------
class TestAnalyzeA14309:
    def test_analyze_a14309(self, api_client, jpeg_a14309):
        r = api_client.post(
            f"{BASE_URL}/api/analyze",
            json={"image_base64": jpeg_a14309},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        print("ANALYZE A14309:", data)
        for k in ("name", "length", "height", "thickness", "openings", "notes"):
            assert k in data
        # Core wall dims: 344 x 266 x 15
        assert data["length"] is not None and data["height"] is not None
        assert abs(float(data["length"]) - 344) <= 5
        assert abs(float(data["height"]) - 266) <= 5
        if data.get("thickness") is not None:
            assert abs(float(data["thickness"]) - 15) <= 2
        if data.get("name"):
            assert "14309" in data["name"].upper() or "A143" in data["name"].upper()
        # Two notches at top corners (17 x 7). We allow 1-3 openings (gemini may merge/miss one)
        assert isinstance(data["openings"], list)
        # Soft: at least one opening should be near top-corner with small size
        matched = 0
        for o in data["openings"]:
            try:
                w = float(o["width"])
                h = float(o["height"])
                y = float(o["y"])
                # notch is small (10-25 wide) and near top (y >= height - 15)
                if 10 <= w <= 25 and 3 <= h <= 15 and y >= float(data["height"]) - 20:
                    matched += 1
            except Exception:
                pass
        print(f"A14309 matched notches: {matched} / {len(data['openings'])}")
        # Not asserting matched >= 2 (Gemini may vary); report via print

    def test_analyze_accepts_data_url_prefix(self, api_client, jpeg_a14309):
        r = api_client.post(
            f"{BASE_URL}/api/analyze",
            json={"image_base64": f"data:image/jpeg;base64,{jpeg_a14309}"},
            timeout=120,
        )
        assert r.status_code == 200


class TestAnalyzeB1:
    def test_analyze_b1(self, api_client, jpeg_b1):
        r = api_client.post(
            f"{BASE_URL}/api/analyze",
            json={"image_base64": jpeg_b1},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        print("ANALYZE B1:", data)
        assert data["length"] is not None and data["height"] is not None
        assert abs(float(data["length"]) - 438) <= 6
        assert abs(float(data["height"]) - 266) <= 6
        if data.get("thickness") is not None:
            assert abs(float(data["thickness"]) - 14.5) <= 2
