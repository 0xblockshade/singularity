"""Tests for the autonomy layer — daily wake scheduling and wiring. No network."""
import importlib
import os

import pytest

from app import repo, scheduler
from app.agent.client import FakeNarrator


def test_build_scheduler_has_one_daily_job(monkeypatch):
    monkeypatch.setenv("INFINITUM_WAKE_HOUR", "7")
    monkeypatch.setenv("INFINITUM_TZ", "UTC")

    # build_scheduler configures but does not start — jobs are pending, no shutdown needed.
    sched = scheduler.build_scheduler()
    jobs = sched.get_jobs()
    assert len(jobs) == 1
    job = jobs[0]
    assert job.id == scheduler.JOB_ID
    assert job.func is scheduler.wake

    # CronTrigger fields — assert it fires daily at hour 7, minute 0. We inspect the
    # trigger's fields rather than sleeping.
    fields = {f.name: str(f) for f in job.trigger.fields}
    assert fields["hour"] == "7"
    assert fields["minute"] == "0"
    # day / month / day_of_week left as wildcards → every day.
    assert fields["day"] == "*"
    assert fields["day_of_week"] == "*"


def test_wake_runs_full_ritual_and_publishes(tmp_path, monkeypatch):
    monkeypatch.setenv("INFINITUM_DB", str(tmp_path / "wake.db"))
    # Reload config so DB_PATH picks up the temp path, and db so it reads the reloaded config.
    from app import config as config_module
    from app import db as db_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(scheduler)

    # Seed something for the ritual to absorb, then wake with an injected FakeNarrator.
    conn = db_module.connect()
    db_module.init_db(conn)
    repo.submit_transmission(conn, "the fans spun up at 3am for no reason", "src1")
    repo.record_signal(conn, "arxiv", "http://x", "self-improving agents", "abstract")
    conn.close()

    result = scheduler.wake(narrator=FakeNarrator(name="Nine"))
    assert result["status"] == "published"

    conn = db_module.connect()
    dispatches = repo.list_dispatches(conn)
    assert len(dispatches) == 1
    assert dispatches[0]["narrator_name"] == "Nine"
    conn.close()


def test_wake_via_fake_env(tmp_path, monkeypatch):
    """INFINITUM_FAKE=1 builds a FakeNarrator internally — no key, no network."""
    monkeypatch.setenv("INFINITUM_DB", str(tmp_path / "fakeenv.db"))
    monkeypatch.setenv("INFINITUM_FAKE", "1")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    from app import config as config_module
    from app import db as db_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(scheduler)

    result = scheduler.wake()
    assert result["status"] == "published"


def test_wake_skips_cleanly_without_key(tmp_path, monkeypatch):
    """No FakeNarrator, no ANTHROPIC_API_KEY → skip, never crash."""
    monkeypatch.setenv("INFINITUM_DB", str(tmp_path / "nokey.db"))
    monkeypatch.delenv("INFINITUM_FAKE", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    from app import config as config_module
    from app import db as db_module

    importlib.reload(config_module)
    importlib.reload(db_module)
    importlib.reload(scheduler)

    result = scheduler.wake()
    assert result["status"] == "skipped"
    assert result["reason"] == "no_narrator"


def test_wake_never_raises_on_failure(monkeypatch):
    """A broken narrator makes the ritual raise; wake must swallow it into a status dict."""

    class Broken:
        model = "broken"

        def narrate(self, system, user):
            raise RuntimeError("boom")

    result = scheduler.wake(narrator=Broken())
    assert result["status"] == "error"


def test_app_startup_without_flag_starts_no_scheduler(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("INFINITUM_DB", str(tmp_path / "app.db"))
    monkeypatch.delenv("INFINITUM_ENABLE_SCHEDULER", raising=False)

    from app import config as config_module
    from app import main as main_module

    importlib.reload(config_module)
    importlib.reload(main_module)

    assert main_module._scheduler_enabled() is False
    with TestClient(main_module.app) as client:
        # lifespan ran; no scheduler was attached.
        assert client.get("/api/dispatches").status_code == 200
        assert main_module.app.state.scheduler is None


def test_app_startup_with_flag_starts_scheduler(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    monkeypatch.setenv("INFINITUM_DB", str(tmp_path / "app2.db"))
    monkeypatch.setenv("INFINITUM_ENABLE_SCHEDULER", "true")

    from app import config as config_module
    from app import main as main_module

    importlib.reload(config_module)
    importlib.reload(main_module)

    assert main_module._scheduler_enabled() is True
    with TestClient(main_module.app) as client:
        assert client.get("/api/dispatches").status_code == 200
        sched = main_module.app.state.scheduler
        assert sched is not None
        assert sched.running
        assert len(sched.get_jobs()) == 1
    # after the context exits, lifespan shutdown ran
