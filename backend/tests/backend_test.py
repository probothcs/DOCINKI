"""Backend API tests for Docinki Pro (snap-wall-cuts).

Covers:
- Health
- Walls CRUD (create / list / get by id / delete, no _id leak, 404 handling)
- Analyze endpoint (Gemini) against a known test drawing (FF Products F1-14402)
"""

import base64
import io
import os
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://snap-wall-cuts.preview.emergentagent.com").rstrip("/")
TEST_IMAGE_URL = (
    "https://customer-assets-0z36b82j.emergentagent.net/"
    "job_dd7d2601-3205-401a-b657-b5386bf78489/artifacts/"
    "fcd52193f94792f6_IMG20260622113145.webp"
)


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def jpeg_b64():
    """Download the test drawing (webp) and transcode to JPEG base64."""
    r = requests.get(TEST_IMAGE_URL, timeout=30)
    r.raise_for_status()
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    # resize if too large
    img.thumbnail((1600, 1600))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


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
            "name": "TEST_WALL_F1-14402",
            "length": 320,
            "height": 301,
            "thickness": 14,
            "openings": [],
            "settings": {
                "blockLength": 50,
                "blockHeight": 25,
                "tolerance100": 100,
                "luz": 1,
                "minPiece": 10,
                "firstCourseHalf": False,
            },
            "result": {
                "module": 50,
                "courseCount": 12,
                "courseHeight": 25.08,
                "heightWarning": False,
                "courses": [],
                "totalFull": 72,
                "totalCuts": 12,
                "cutGroups": [{"len": 19, "count": 12}],
            },
        }

    def test_01_create_wall(self, api_client):
        r = api_client.post(f"{BASE_URL}/api/walls", json=self._wall_payload())
        assert r.status_code == 200, r.text
        data = r.json()
        assert "_id" not in data, "ObjectId leaked in response"
        assert isinstance(data.get("id"), str) and len(data["id"]) > 0
        assert data["name"] == "TEST_WALL_F1-14402"
        assert data["length"] == 320
        assert data["height"] == 301
        assert data["result"]["totalCuts"] == 12
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
        assert data["length"] == 320
        assert "_id" not in data

    def test_04_get_invalid_id_returns_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/walls/not-a-valid-objectid")
        assert r.status_code == 404

    def test_05_get_nonexistent_id_returns_404(self, api_client):
        # Valid-looking ObjectId that doesn't exist
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
class TestAnalyze:
    def test_analyze_returns_expected_dims(self, api_client, jpeg_b64):
        r = api_client.post(
            f"{BASE_URL}/api/analyze",
            json={"image_base64": jpeg_b64},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("name", "length", "height", "thickness", "openings", "notes"):
            assert k in data
        assert isinstance(data["openings"], list)
        # Expected for F1-14402: 320 x 301 x 14 cm
        # Allow slight tolerance on numbers but strict on the element name presence
        print("ANALYZE RESPONSE:", data)
        # Soft asserts (gemini can vary): we just require the critical fields non-null
        assert data["length"] is not None and data["height"] is not None
        # Core dims close enough
        assert abs(float(data["length"]) - 320) <= 5
        assert abs(float(data["height"]) - 301) <= 5
        if data.get("thickness") is not None:
            assert abs(float(data["thickness"]) - 14) <= 2
        if data.get("name"):
            assert "14402" in data["name"] or "F1" in data["name"].upper()

    def test_analyze_accepts_data_url_prefix(self, api_client, jpeg_b64):
        r = api_client.post(
            f"{BASE_URL}/api/analyze",
            json={"image_base64": f"data:image/jpeg;base64,{jpeg_b64}"},
            timeout=120,
        )
        assert r.status_code == 200
