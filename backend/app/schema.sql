-- singularity data model. See docs/DESIGN.md §4.
-- Dispatches and memory versions are immutable once written — the archive is the artwork.

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

-- One row per daily wake.
CREATE TABLE IF NOT EXISTS runs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at    TEXT NOT NULL,
    finished_at   TEXT,
    status        TEXT NOT NULL,            -- running | published | blocked | error
    model         TEXT,
    input_tokens  INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    note          TEXT                      -- error text or block reason
);

-- Public submissions. Raw firehose: everything is stored; flags are metadata only,
-- never edits. The agent reads flagged and unflagged alike.
CREATE TABLE IF NOT EXISTS transmissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    body         TEXT NOT NULL,
    received_at  TEXT NOT NULL,
    source_hash  TEXT,                      -- hashed visitor id (rate-limit / dedup only)
    body_hash    TEXT,
    processed_at TEXT,                       -- set when a run has absorbed it
    run_id       INTEGER REFERENCES runs(id),
    flagged      INTEGER DEFAULT 0,          -- 1 = rate-limited or duplicate (still stored)
    flag_reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_processed ON transmissions(processed_at);
CREATE INDEX IF NOT EXISTS idx_tx_source    ON transmissions(source_hash, received_at);
CREATE INDEX IF NOT EXISTS idx_tx_body      ON transmissions(body_hash, received_at);

-- World-signals gathered by the scan step (Phase 4 adapters fill this).
CREATE TABLE IF NOT EXISTS signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    adapter     TEXT NOT NULL,              -- web | arxiv | news | reddit | x | ...
    url         TEXT,
    title       TEXT,
    summary     TEXT,
    fetched_at  TEXT NOT NULL,
    salience    REAL DEFAULT 0,
    used_in_run INTEGER REFERENCES runs(id)
);
CREATE INDEX IF NOT EXISTS idx_sig_used ON signals(used_in_run);

-- Published dispatches. Immutable.
CREATE TABLE IF NOT EXISTS dispatches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id        INTEGER REFERENCES runs(id),
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,             -- markdown, unedited
    published_at  TEXT NOT NULL,
    model         TEXT,
    narrator_name TEXT
);

-- Append-only versioned belief state. Each row is a snapshot of the narrator's mind.
CREATE TABLE IF NOT EXISTS memory (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    version        INTEGER NOT NULL,
    created_at     TEXT NOT NULL,
    run_id         INTEGER REFERENCES runs(id),
    state_json     TEXT NOT NULL,            -- {"name":..., "worldview":...}
    change_summary TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mem_version ON memory(version);

-- The belief graph: concepts and stances that evolve over time.
CREATE TABLE IF NOT EXISTS beliefs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    concept         TEXT NOT NULL UNIQUE,
    stance          TEXT NOT NULL,
    confidence      REAL DEFAULT 0.5,
    first_seen_run  INTEGER,
    last_changed_run INTEGER,
    updated_at      TEXT NOT NULL
);

-- The Sandbox: recursive self-improvement log. Each row is one revision the agent made
-- to one of its own analytical faculties (methods/heuristics), sourced to the research
-- signals that prompted it. Append-only — the record of a mind improving itself.
CREATE TABLE IF NOT EXISTS improvements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER,
  cycle INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  faculty TEXT NOT NULL,
  change TEXT NOT NULL,
  detail TEXT NOT NULL,
  rationale TEXT NOT NULL,
  cited_signals TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY(run_id) REFERENCES runs(id)
);
CREATE INDEX IF NOT EXISTS idx_improvements_cycle ON improvements(cycle);

-- Attribution: which transmissions / signals shaped a given dispatch.
CREATE TABLE IF NOT EXISTS sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id INTEGER NOT NULL REFERENCES dispatches(id),
    kind        TEXT NOT NULL,               -- transmission | signal
    ref_id      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_src_dispatch ON sources(dispatch_id);
