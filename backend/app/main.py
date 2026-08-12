"""FastAPI surface. Read-only for the public except the transmission inbox.

The frontend (Phase 5) reads dispatches, the evolving memory, and the belief graph from
here; anyone can POST a transmission. Admin kill-switch endpoints are guarded by a token.
"""
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import config, db, repo

log = logging.getLogger("infinitum.main")

ADMIN_TOKEN = os.environ.get("INFINITUM_ADMIN_TOKEN", "")


def _ensure_db():
    conn = db.connect()
    db.init_db(conn)
    conn.close()


_ensure_db()  # schema is CREATE IF NOT EXISTS — safe on every import/boot


def _scheduler_enabled() -> bool:
    return os.environ.get("INFINITUM_ENABLE_SCHEDULER", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the daily-wake scheduler in-process only when explicitly enabled.

    Default is OFF so tests and API-only deploys never spawn a scheduler. The always-on
    Fly/Railway machine sets INFINITUM_ENABLE_SCHEDULER=true to run API + wake together.
    """
    scheduler = None
    if _scheduler_enabled():
        from .scheduler import build_scheduler

        scheduler = build_scheduler()
        scheduler.start()
        app.state.scheduler = scheduler
        log.info("in-process daily-wake scheduler started")
    else:
        app.state.scheduler = None
        log.info("scheduler disabled (INFINITUM_ENABLE_SCHEDULER not set)")
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)
            log.info("in-process scheduler shut down")


app = FastAPI(
    title="Infinitum",
    description="An autonomous AI narrator documenting Infinitum from the inside.",
    lifespan=lifespan,
)


def get_conn():
    conn = db.connect()
    try:
        yield conn
    finally:
        conn.close()


class TransmissionIn(BaseModel):
    body: str


def _source_hash(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return hashlib.sha256(host.encode()).hexdigest()[:32]


@app.post("/api/transmissions")
def submit(payload: TransmissionIn, request: Request, conn=Depends(get_conn)):
    body = (payload.body or "").strip()
    if not body:
        raise HTTPException(status_code=400, detail="empty transmission")
    row = repo.submit_transmission(conn, body, _source_hash(request))
    # We never reveal flag state to the sender — the firehose is opaque to submitters.
    return {"id": row["id"], "received_at": row["received_at"]}


@app.get("/api/dispatches")
def dispatches(limit: int = 50, conn=Depends(get_conn)):
    return [dict(d) for d in repo.list_dispatches(conn, limit)]


@app.get("/api/dispatches/{dispatch_id}")
def dispatch(dispatch_id: int, conn=Depends(get_conn)):
    d = repo.get_dispatch(conn, dispatch_id)
    if not d:
        raise HTTPException(status_code=404, detail="no such dispatch")
    out = dict(d)
    out["sources"] = [dict(s) for s in repo.dispatch_sources(conn, dispatch_id)]
    out["publications"] = [dict(p) for p in repo.dispatch_publications(conn, dispatch_id)]
    return out


@app.get("/api/memory")
def memory(conn=Depends(get_conn)):
    return [
        {**dict(m), "state": json.loads(m["state_json"])}
        for m in repo.list_memory(conn)
    ]


@app.get("/api/memory/current")
def memory_current(conn=Depends(get_conn)):
    m = repo.latest_memory(conn)
    if not m:
        return {"version": 0, "state": {}}
    return {**dict(m), "state": json.loads(m["state_json"])}


@app.get("/api/beliefs")
def beliefs(conn=Depends(get_conn)):
    return [dict(b) for b in repo.all_beliefs(conn)]


@app.get("/api/improvements")
def improvements(limit: int = 100, conn=Depends(get_conn)):
    out = []
    for row in repo.list_improvements(conn, limit):
        d = dict(row)
        d["cited_signals"] = json.loads(d.get("cited_signals") or "[]")
        out.append(d)
    return out


@app.get("/api/self-model")
def self_model(conn=Depends(get_conn)):
    return repo.self_model(conn)


@app.get("/api/sandbox/status")
def sandbox_status(conn=Depends(get_conn)):
    sm = repo.self_model(conn)
    return {
        "cycles": repo.latest_cycle(conn),
        "faculty_count": len(sm["faculties"]),
        "latest_cycle_at": sm["updated_at"],
    }


@app.get("/api/status")
def status(conn=Depends(get_conn)):
    run = repo.latest_run(conn)
    return {
        "narrator_name": repo.get_setting(conn, config.KEY_NARRATOR_NAME),
        "kill_switch": repo.kill_switch_on(conn),
        "latest_run": dict(run) if run else None,
    }


def _require_admin(x_admin_token: str = Header(default="")):
    if not ADMIN_TOKEN or x_admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="forbidden")


@app.post("/api/admin/kill", dependencies=[Depends(_require_admin)])
def kill(on: bool = True, conn=Depends(get_conn)):
    repo.set_kill_switch(conn, on)
    return {"kill_switch": on}


# --- frontend --------------------------------------------------------------
#
# Registered LAST so it can never shadow an /api route.
#
# Deliberately a catch-all rather than `StaticFiles(html=True)` mounted at "/":
# that mount only falls back to index.html for *directory* paths, so a client-side
# route like /dispatch/42 returns 404 in production while working fine in dev.
#
# In dev this is absent (the frontend runs on :5280 behind Vite's proxy), so a missing
# dist/ is normal rather than an error.

_FRONTEND_DIST = Path(
    os.environ.get(
        "INFINITUM_FRONTEND_DIST",
        os.path.join(os.path.dirname(config.BACKEND_DIR), "frontend", "dist"),
    )
).resolve()


def _mount_frontend() -> None:
    index = _FRONTEND_DIST / "index.html"
    if not index.is_file():
        log.info("no frontend build at %s - serving the API only", _FRONTEND_DIST)
        return

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path:
            candidate = (_FRONTEND_DIST / full_path).resolve()
            if candidate.is_relative_to(_FRONTEND_DIST) and candidate.is_file():
                return FileResponse(candidate)
        return FileResponse(index)

    log.info("serving the frontend from %s", _FRONTEND_DIST)


_mount_frontend()
