"""Backend tests for iteration 5 — topVariant + kimlaga persistence on /api/walls."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://snap-wall-cuts.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def wall_payload():
    return {
        "name": "TEST_variant",
        "length": 312.0,
        "height": 266.0,
        "thickness": 14.0,
        "openings": [
            {"x": 0, "y": 259, "width": 17, "height": 7},
            {"x": 295, "y": 259, "width": 17, "height": 7},
        ],
        "project": "TEST_variant_project",
        "photo_path": "",
        "topVariant": "brick:14",
        "kimlaga": True,
        "settings": {},
        "result": {},
    }


class TestWallsAPIVariant:
    """CRUD on /api/walls with topVariant + kimlaga fields."""

    def test_health(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("message")

    def test_create_wall_persists_top_variant_and_kimlaga(self, api_client, wall_payload):
        r = api_client.post(f"{BASE_URL}/api/walls", json=wall_payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["topVariant"] == "brick:14"
        assert data["kimlaga"] is True
        assert data["length"] == 312.0
        wall_id = data["id"]
        assert wall_id and len(wall_id) == 24

        # GET verifies persistence
        g = api_client.get(f"{BASE_URL}/api/walls/{wall_id}")
        assert g.status_code == 200
        got = g.json()
        assert got["topVariant"] == "brick:14"
        assert got["kimlaga"] is True
        assert "_id" not in got  # ObjectId must be excluded

        # cleanup
        api_client.delete(f"{BASE_URL}/api/walls/{wall_id}")

    def test_create_without_variant_defaults_null(self, api_client, wall_payload):
        wall_payload.pop("topVariant", None)
        wall_payload.pop("kimlaga", None)
        r = api_client.post(f"{BASE_URL}/api/walls", json=wall_payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("topVariant") is None
        assert data.get("kimlaga") is None
        wall_id = data["id"]
        api_client.delete(f"{BASE_URL}/api/walls/{wall_id}")

    def test_list_walls_includes_fields(self, api_client, wall_payload):
        wall_payload["topVariant"] = "half"
        wall_payload["kimlaga"] = False
        r = api_client.post(f"{BASE_URL}/api/walls", json=wall_payload)
        assert r.status_code == 200
        wall_id = r.json()["id"]

        lst = api_client.get(f"{BASE_URL}/api/walls")
        assert lst.status_code == 200
        items = lst.json()
        mine = [w for w in items if w["id"] == wall_id]
        assert mine, "created wall not in list"
        assert mine[0]["topVariant"] == "half"
        assert mine[0]["kimlaga"] is False

        api_client.delete(f"{BASE_URL}/api/walls/{wall_id}")

    def test_delete_returns_404_after(self, api_client, wall_payload):
        r = api_client.post(f"{BASE_URL}/api/walls", json=wall_payload)
        wall_id = r.json()["id"]
        d = api_client.delete(f"{BASE_URL}/api/walls/{wall_id}")
        assert d.status_code == 200
        g = api_client.get(f"{BASE_URL}/api/walls/{wall_id}")
        assert g.status_code == 404

    def test_invalid_id_404(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/walls/notanid")
        assert r.status_code == 404
