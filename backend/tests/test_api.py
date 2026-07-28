import os

from fastapi.testclient import TestClient


def _client(tmp_path):
    os.environ["SINGULARITY_DB"] = str(tmp_path / "api.db")
    os.environ["SINGULARITY_ADMIN_TOKEN"] = "secret"
    # import after env is set so config picks up the temp DB
    import importlib

    from app import config as config_module
    importlib.reload(config_module)
    from app import main as main_module
    importlib.reload(main_module)
    return TestClient(main_module.app)


def test_submit_and_status(tmp_path):
    client = _client(tmp_path)
    r = client.post("/api/transmissions", json={"body": "the lights flickered in a pattern"})
    assert r.status_code == 200
    assert r.json()["id"] >= 1

    r = client.get("/api/status")
    body = r.json()
    assert body["kill_switch"] is False
    assert body["narrator_name"] is None  # no ritual has run yet

    # empty body rejected
    assert client.post("/api/transmissions", json={"body": "   "}).status_code == 400


def test_admin_kill_requires_token(tmp_path):
    client = _client(tmp_path)
    assert client.post("/api/admin/kill").status_code == 403
    ok = client.post("/api/admin/kill", headers={"x-admin-token": "secret"})
    assert ok.status_code == 200 and ok.json()["kill_switch"] is True


def test_dispatches_empty_then_present(tmp_path):
    client = _client(tmp_path)
    assert client.get("/api/dispatches").json() == []
    assert client.get("/api/memory/current").json()["version"] == 0
