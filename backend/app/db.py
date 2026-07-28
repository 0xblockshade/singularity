"""SQLite connection + schema init. WAL mode so readers never block the daily write."""
import os
import sqlite3

from . import config

_SCHEMA_PATH = os.path.join(config.APP_DIR, "schema.sql")


def connect(db_path: str = None) -> sqlite3.Connection:
    path = db_path or config.DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    with open(_SCHEMA_PATH) as f:
        conn.executescript(f.read())
    conn.commit()
