"""Data-access layer. All SQL lives here; callers pass a connection.

Dispatches and memory versions are write-once by convention — there are no update
helpers for them, only inserts. The archive is never retconned.
"""
import datetime
import hashlib
import json
import sqlite3
from typing import List, Optional

from . import config


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------- settings ----------

def get_setting(conn, key: str) -> Optional[str]:
    row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    return row["value"] if row else None


def set_setting(conn, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()


def kill_switch_on(conn) -> bool:
    return get_setting(conn, config.KEY_KILL_SWITCH) == "1"


def set_kill_switch(conn, on: bool) -> None:
    set_setting(conn, config.KEY_KILL_SWITCH, "1" if on else "0")


# ---------- transmissions ----------

def submit_transmission(conn, body: str, source_hash: str) -> sqlite3.Row:
    """Store a public transmission. Raw firehose: always stored. `flagged` is metadata
    (rate-limit / duplicate) that the agent may weigh — it is never an edit or a drop."""
    body = body[: config.MAX_TRANSMISSION_CHARS]
    received = now_iso()
    bhash = _hash(body.strip().lower())
    window_start = (
        datetime.datetime.now(datetime.timezone.utc)
        - datetime.timedelta(minutes=config.DEDUP_WINDOW_MIN)
    ).isoformat()

    flagged, reason = 0, None
    recent_same_source = conn.execute(
        "SELECT COUNT(*) c FROM transmissions WHERE source_hash=? AND received_at>=?",
        (source_hash, window_start),
    ).fetchone()["c"]
    if recent_same_source >= config.RATE_LIMIT_PER_HOUR:
        flagged, reason = 1, "rate_limited"

    dup = conn.execute(
        "SELECT id FROM transmissions WHERE body_hash=? AND received_at>=?",
        (bhash, window_start),
    ).fetchone()
    if dup and not flagged:
        flagged, reason = 1, "duplicate"

    cur = conn.execute(
        "INSERT INTO transmissions(body, received_at, source_hash, body_hash, flagged, flag_reason) "
        "VALUES(?,?,?,?,?,?)",
        (body, received, source_hash, bhash, flagged, reason),
    )
    conn.commit()
    return conn.execute("SELECT * FROM transmissions WHERE id=?", (cur.lastrowid,)).fetchone()


def unprocessed_transmissions(conn, limit: int) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM transmissions WHERE processed_at IS NULL ORDER BY received_at ASC LIMIT ?",
        (limit,),
    ).fetchall()


def mark_transmissions_processed(conn, ids: List[int], run_id: int) -> None:
    if not ids:
        return
    ts = now_iso()
    conn.executemany(
        "UPDATE transmissions SET processed_at=?, run_id=? WHERE id=?",
        [(ts, run_id, i) for i in ids],
    )
    conn.commit()


# ---------- signals ----------

def record_signal(conn, adapter: str, url: str, title: str, summary: str, salience: float = 0.0) -> int:
    cur = conn.execute(
        "INSERT INTO signals(adapter, url, title, summary, fetched_at, salience) VALUES(?,?,?,?,?,?)",
        (adapter, url, title, summary, now_iso(), salience),
    )
    conn.commit()
    return cur.lastrowid


def unused_signals(conn, limit: int) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM signals WHERE used_in_run IS NULL ORDER BY salience DESC, fetched_at DESC LIMIT ?",
        (limit,),
    ).fetchall()


def mark_signals_used(conn, ids: List[int], run_id: int) -> None:
    if not ids:
        return
    conn.executemany(
        "UPDATE signals SET used_in_run=? WHERE id=?", [(run_id, i) for i in ids]
    )
    conn.commit()


# ---------- runs ----------

def create_run(conn, model: str) -> int:
    cur = conn.execute(
        "INSERT INTO runs(started_at, status, model) VALUES(?, 'running', ?)",
        (now_iso(), model),
    )
    conn.commit()
    return cur.lastrowid


def finish_run(conn, run_id: int, status: str, in_tok: int = 0, out_tok: int = 0, note: str = None) -> None:
    conn.execute(
        "UPDATE runs SET finished_at=?, status=?, input_tokens=?, output_tokens=?, note=? WHERE id=?",
        (now_iso(), status, in_tok, out_tok, note, run_id),
    )
    conn.commit()


def latest_run(conn) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM runs ORDER BY id DESC LIMIT 1").fetchone()


# ---------- memory + beliefs ----------

def latest_memory(conn) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM memory ORDER BY version DESC LIMIT 1").fetchone()


def list_memory(conn) -> List[sqlite3.Row]:
    return conn.execute("SELECT * FROM memory ORDER BY version DESC").fetchall()


def insert_memory_version(conn, run_id: int, name: str, worldview: str, change_summary: str) -> int:
    row = latest_memory(conn)
    version = (row["version"] + 1) if row else 1
    state = json.dumps({"name": name, "worldview": worldview})
    cur = conn.execute(
        "INSERT INTO memory(version, created_at, run_id, state_json, change_summary) VALUES(?,?,?,?,?)",
        (version, now_iso(), run_id, state, change_summary),
    )
    conn.commit()
    return cur.lastrowid


def upsert_belief(conn, concept: str, stance: str, confidence: float, run_id: int) -> None:
    existing = conn.execute("SELECT * FROM beliefs WHERE concept=?", (concept,)).fetchone()
    ts = now_iso()
    if existing is None:
        conn.execute(
            "INSERT INTO beliefs(concept, stance, confidence, first_seen_run, last_changed_run, updated_at) "
            "VALUES(?,?,?,?,?,?)",
            (concept, stance, confidence, run_id, run_id, ts),
        )
    else:
        changed = existing["stance"] != stance or abs((existing["confidence"] or 0) - confidence) > 1e-6
        conn.execute(
            "UPDATE beliefs SET stance=?, confidence=?, last_changed_run=?, updated_at=? WHERE concept=?",
            (stance, confidence, run_id if changed else existing["last_changed_run"], ts, concept),
        )
    conn.commit()


def all_beliefs(conn) -> List[sqlite3.Row]:
    return conn.execute("SELECT * FROM beliefs ORDER BY updated_at DESC").fetchall()


# ---------- dispatches + sources ----------

def insert_dispatch(conn, run_id: int, title: str, body: str, model: str, narrator_name: str) -> int:
    cur = conn.execute(
        "INSERT INTO dispatches(run_id, title, body, published_at, model, narrator_name) VALUES(?,?,?,?,?,?)",
        (run_id, title, body, now_iso(), model, narrator_name),
    )
    conn.commit()
    return cur.lastrowid


def insert_source(conn, dispatch_id: int, kind: str, ref_id: int) -> None:
    conn.execute(
        "INSERT INTO sources(dispatch_id, kind, ref_id) VALUES(?,?,?)",
        (dispatch_id, kind, ref_id),
    )
    conn.commit()


def list_dispatches(conn, limit: int = 50) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM dispatches ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()


def get_dispatch(conn, dispatch_id: int) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM dispatches WHERE id=?", (dispatch_id,)).fetchone()


def dispatch_sources(conn, dispatch_id: int) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM sources WHERE dispatch_id=?", (dispatch_id,)
    ).fetchall()


# ---------- sandbox: recursive self-improvement ----------

def latest_cycle(conn) -> int:
    """The highest self-improvement cycle so far (0 if the sandbox has never run)."""
    row = conn.execute("SELECT MAX(cycle) AS c FROM improvements").fetchone()
    return (row["c"] or 0) if row else 0


def insert_improvement(
    conn,
    run_id: int,
    cycle: int,
    faculty: str,
    change: str,
    detail: str,
    rationale: str,
    cited_signals: List[int],
) -> int:
    """Append one revision of an analytical faculty. cited_signals is stored as JSON."""
    cur = conn.execute(
        "INSERT INTO improvements(run_id, cycle, created_at, faculty, change, detail, rationale, cited_signals) "
        "VALUES(?,?,?,?,?,?,?,?)",
        (
            run_id,
            cycle,
            now_iso(),
            faculty,
            change,
            detail,
            rationale,
            json.dumps(list(cited_signals or [])),
        ),
    )
    conn.commit()
    return cur.lastrowid


def list_improvements(conn, limit: int = 200) -> List[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM improvements ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()


def recent_research_signals(conn, limit: int) -> List[sqlite3.Row]:
    """Most recent research signals (arxiv/news) the sandbox studies. Independent of
    used_in_run — the sandbox reads papers whether or not a dispatch has cited them."""
    return conn.execute(
        "SELECT * FROM signals WHERE adapter IN ('arxiv','news') "
        "ORDER BY fetched_at DESC LIMIT ?",
        (limit,),
    ).fetchall()


def self_model(conn) -> dict:
    """Derive the current self-model from the append-only improvements log. For each
    distinct faculty, the most recent improvement's `detail` is its current method."""
    rows = conn.execute(
        "SELECT cycle, created_at, faculty, detail FROM improvements ORDER BY id ASC"
    ).fetchall()

    faculties: dict = {}
    latest_created = None
    for r in rows:
        latest_created = r["created_at"]  # rows in id (chronological) order
        name = r["faculty"]
        f = faculties.get(name)
        if f is None:
            faculties[name] = {
                "name": name,
                "current_method": r["detail"],
                "times_revised": 1,
                "first_cycle": r["cycle"],
                "last_cycle": r["cycle"],
            }
        else:
            f["current_method"] = r["detail"]
            f["times_revised"] += 1
            f["last_cycle"] = r["cycle"]

    ordered = sorted(faculties.values(), key=lambda f: f["last_cycle"], reverse=True)
    return {
        "version": latest_cycle(conn),
        "updated_at": latest_created,
        "faculties": ordered,
    }
