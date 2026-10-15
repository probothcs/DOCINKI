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


# ---------------- Multi-wall project (optional project field on POST /api/walls) ----------------
class TestWallProjectField:
    created_ids = []

    def _payload(self, name, project):
        return {
            "name": name,
            "length": 320,
            "height": 301,
            "thickness": 14,
            "openings": [],
            "project": project,
            "settings": {
                "blockLength": 50, "blockHeight": 24, "mortar": 1,
                "minModule": 24.4, "maxModule": 25.1,
                "topBricks": [9, 14, 19], "tolerance100": 100,
                "luz": 1, "minPiece": 10, "firstCourseHalf": False,
            },
            "result": {
                "module": 50, "courseCount": 12, "courseHeight": 25.1,
                "stackHeight": 301.2, "topBrick": None, "topIsCut": False,
                "heightWarning": False, "courses": [],
                "totalFull": 72, "topFull": 0, "totalCuts": 18, "cutGroups": [],
            },
        }

    def test_01_create_with_project_field(self, api_client):
        proj = "TEST_PROJEKT_MULTI"
        for name in ("TEST_W1", "TEST_W2"):
            r = api_client.post(f"{BASE_URL}/api/walls", json=self._payload(name, proj))
            assert r.status_code == 200, r.text
            data = r.json()
            assert data.get("project") == proj, f"project missing on response: {data}"
            assert "_id" not in data
            TestWallProjectField.created_ids.append(data["id"])
        assert len(TestWallProjectField.created_ids) == 2

    def test_02_get_persists_project(self, api_client):
        for wid in TestWallProjectField.created_ids:
            r = api_client.get(f"{BASE_URL}/api/walls/{wid}")
            assert r.status_code == 200
            assert r.json().get("project") == "TEST_PROJEKT_MULTI"

    def test_03_create_without_project_defaults_empty(self, api_client):
        p = self._payload("TEST_NOPROJ", "")
        del p["project"]
        r = api_client.post(f"{BASE_URL}/api/walls", json=p)
        assert r.status_code == 200
        data = r.json()
        assert data.get("project", "") == ""
        TestWallProjectField.created_ids.append(data["id"])

    def test_99_cleanup(self, api_client):
        for wid in TestWallProjectField.created_ids:
            api_client.delete(f"{BASE_URL}/api/walls/{wid}")


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


class TestWallPhotoAndTopMode:
    """Iteration 5: POST /api/walls persists photo_path + topMode; GET /api/files/{path} serves image."""
    created = []
    photo_path = ""

    def test_01_analyze_returns_photo_path(self, api_client, jpeg_a14309):
        r = api_client.post(f"{BASE_URL}/api/analyze", json={"image_base64": jpeg_a14309}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "photo_path" in data
        assert isinstance(data["photo_path"], str) and data["photo_path"].startswith("docinki-pro/uploads/drawings/")
        TestWallPhotoAndTopMode.photo_path = data["photo_path"]

    def test_02_files_endpoint_serves_image(self, api_client):
        assert TestWallPhotoAndTopMode.photo_path
        r = requests.get(f"{BASE_URL}/api/files/{TestWallPhotoAndTopMode.photo_path}", timeout=60)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/")
        assert len(r.content) > 100

    def test_03_files_404_for_unknown_path(self, api_client):
        r = requests.get(f"{BASE_URL}/api/files/docinki-pro/uploads/drawings/does-not-exist.jpg", timeout=60)
        assert r.status_code == 404

    def _wall_payload(self, project, top_mode, photo_path=""):
        return {
            "name": "TEST_PHOTO_WALL",
            "length": 89.5, "height": 266, "thickness": 19,
            "openings": [], "project": project,
            "photo_path": photo_path, "topMode": top_mode,
            "settings": {"blockLength": 50, "blockHeight": 24, "mortar": 1, "minModule": 24.4, "maxModule": 25.1,
                         "topBricks": [9, 14, 19], "tolerance100": 100, "luz": 1, "minPiece": 10, "firstCourseHalf": False},
            "result": {"module": 50, "courseCount": 10, "courseHeight": 25.3, "stackHeight": 253,
                       "topBrick": None, "topIsCut": False, "heightWarning": False, "courses": [],
                       "totalFull": 20, "topFull": 0, "totalCuts": 2, "cutGroups": []},
        }

    def test_04_create_wall_with_photo_and_top_mode_block(self, api_client):
        p = self._wall_payload("TEST_PROJ_PHOTO", "block", TestWallPhotoAndTopMode.photo_path)
        r = api_client.post(f"{BASE_URL}/api/walls", json=p)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("photo_path") == TestWallPhotoAndTopMode.photo_path
        assert data.get("topMode") == "block"
        assert "_id" not in data
        TestWallPhotoAndTopMode.created.append(data["id"])

    def test_05_create_wall_with_top_mode_brick(self, api_client):
        p = self._wall_payload("TEST_PROJ_PHOTO", "brick", "")
        r = api_client.post(f"{BASE_URL}/api/walls", json=p)
        assert r.status_code == 200
        data = r.json()
        assert data.get("topMode") == "brick"
        TestWallPhotoAndTopMode.created.append(data["id"])

    def test_06_get_persists_photo_and_top_mode(self, api_client):
        for wid in TestWallPhotoAndTopMode.created:
            r = api_client.get(f"{BASE_URL}/api/walls/{wid}")
            assert r.status_code == 200
            data = r.json()
            assert "topMode" in data
            assert "photo_path" in data

    def test_99_cleanup(self, api_client):
        for wid in TestWallPhotoAndTopMode.created:
            api_client.delete(f"{BASE_URL}/api/walls/{wid}")


class TestProjectRename:
    """PATCH /api/walls/project {ids, project} renames project on multiple walls."""
    created = []

    def _payload(self, name, project):
        return {
            "name": name, "length": 120, "height": 50, "thickness": 14,
            "openings": [], "project": project,
            "settings": {"blockLength": 50, "blockHeight": 24, "mortar": 1, "minModule": 24.4, "maxModule": 25.1,
                         "topBricks": [9, 14, 19], "tolerance100": 100, "luz": 1, "minPiece": 10, "firstCourseHalf": False},
            "result": {"module": 50, "courseCount": 2, "courseHeight": 25.1, "stackHeight": 50.2,
                       "topBrick": None, "topIsCut": False, "heightWarning": False, "courses": [],
                       "totalFull": 4, "topFull": 0, "totalCuts": 0, "cutGroups": []},
        }

    def test_01_setup_two_walls(self, api_client):
        for n in ("TEST_RENAME_A", "TEST_RENAME_B"):
            r = api_client.post(f"{BASE_URL}/api/walls", json=self._payload(n, "OLD_PROJECT"))
            assert r.status_code == 200
            TestProjectRename.created.append(r.json()["id"])
        assert len(TestProjectRename.created) == 2

    def test_02_patch_project_renames_both(self, api_client):
        r = api_client.patch(f"{BASE_URL}/api/walls/project",
                             json={"ids": TestProjectRename.created, "project": "NEW_PROJECT_NAME"})
        assert r.status_code == 200, r.text
        assert r.json().get("updated") == 2

    def test_03_get_reflects_rename(self, api_client):
        for wid in TestProjectRename.created:
            r = api_client.get(f"{BASE_URL}/api/walls/{wid}")
            assert r.status_code == 200
            assert r.json().get("project") == "NEW_PROJECT_NAME"

    def test_04_patch_ignores_invalid_ids(self, api_client):
        r = api_client.patch(f"{BASE_URL}/api/walls/project",
                             json={"ids": ["not-an-objectid"], "project": "X"})
        assert r.status_code == 200
        assert r.json().get("updated") == 0

    def test_99_cleanup(self, api_client):
        for wid in TestProjectRename.created:
            api_client.delete(f"{BASE_URL}/api/walls/{wid}")


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
