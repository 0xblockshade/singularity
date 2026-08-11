"""Tests for the Sandbox (recursive self-improvement) loop. No network."""
import importlib
import json
import os

from fastapi.testclient import TestClient

from app import repo
from app.agent import client as narrator_client
from app.agent import sandbox


def _seed_research(conn, n=3):
    ids = []
    for i in range(n):
        ids.append(
            repo.record_signal(
                conn,
                "arxiv",
                f"http://arxiv.org/abs/{i}",
                f"paper {i}",
                "on recursive self-improvement and scaling",
                salience=0.9,
            )
        )
    return ids


def test_run_sandbox_records_and_cycles_increment(conn):
    _seed_research(conn)
    narrator = narrator_client.FakeNarrator()

    r1 = sandbox.run_sandbox(conn, narrator, model_name="fake")
    assert r1["status"] == "improved"
    assert r1["cycle"] == 1
    assert r1["count"] == 1
    assert r1["reflection"]

    r2 = sandbox.run_sandbox(conn, narrator, model_name="fake")
    assert r2["status"] == "improved"
    assert r2["cycle"] == 2

    assert repo.latest_cycle(conn) == 2

    # self_model reflects the latest method per faculty with correct revision count.
    sm = repo.self_model(conn)
    assert sm["version"] == 2
    assert sm["updated_at"] is not None
    assert len(sm["faculties"]) == 1  # both cycles revise the same faculty
    fac = sm["faculties"][0]
    assert fac["name"] == "acceleration reading"
    assert fac["times_revised"] == 2
    assert fac["first_cycle"] == 1
    assert fac["last_cycle"] == 2
    # current_method is the detail from the latest improvement (id DESC).
    latest = repo.list_improvements(conn)[0]
    assert fac["current_method"] == latest["detail"]


def test_cited_signals_validation_drops_phantom_ids(conn):
    sig_ids = _seed_research(conn, n=2)
    narrator = narrator_client.FakeNarrator()
    sandbox.run_sandbox(conn, narrator, model_name="fake")

    imp = repo.list_improvements(conn)[0]
    cited = json.loads(imp["cited_signals"])
    # Fake cites the first 1-2 fed ids; all must be real signal ids.
    assert cited
    assert set(cited).issubset(set(sig_ids))


def test_kill_switch_halts_sandbox(conn):
    _seed_research(conn)
    repo.set_kill_switch(conn, True)
    narrator = narrator_client.FakeNarrator()

    result = sandbox.run_sandbox(conn, narrator, model_name="fake")
    assert result["status"] == "halted"
    assert repo.list_improvements(conn) == []
    assert repo.latest_cycle(conn) == 0


def _client(tmp_path):
    os.environ["INFINITUM_DB"] = str(tmp_path / "sandbox_api.db")
    from app import config as config_module
    importlib.reload(config_module)
    from app import main as main_module
    importlib.reload(main_module)
    return main_module, TestClient(main_module.app)


def test_sandbox_endpoints(tmp_path):
    main_module, client = _client(tmp_path)

    # Empty shapes are sane.
    assert client.get("/api/improvements").json() == []
    sm = client.get("/api/self-model").json()
    assert sm["version"] == 0 and sm["faculties"] == []
    st = client.get("/api/sandbox/status").json()
    assert st == {"cycles": 0, "faculty_count": 0, "latest_cycle_at": None}

    # Run a fake sandbox cycle against the same DB the app reads.
    from app import db as db_module
    conn = db_module.connect()
    db_module.init_db(conn)
    _seed_research(conn)
    sandbox.run_sandbox(conn, narrator_client.FakeNarrator(), model_name="fake")
    conn.close()

    imps = client.get("/api/improvements").json()
    assert len(imps) == 1
    row = imps[0]
    assert set(row) >= {
        "id", "run_id", "cycle", "created_at", "faculty",
        "change", "detail", "rationale", "cited_signals",
    }
    assert isinstance(row["cited_signals"], list)

    sm = client.get("/api/self-model").json()
    assert sm["version"] == 1
    assert len(sm["faculties"]) == 1

    st = client.get("/api/sandbox/status").json()
    assert st["cycles"] == 1
    assert st["faculty_count"] == 1
    assert st["latest_cycle_at"] is not None
