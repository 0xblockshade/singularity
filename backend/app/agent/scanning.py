"""Signal gathering.

Phase 4 fills this with real, swappable adapters (web search + arXiv + news RSS, then a
social-pulse adapter for Reddit / X). Each adapter writes rows into the `signals` table via
repo.record_signal; the ToS-gray social sources stay behind this seam so they can be swapped
without touching the ritual.

For now `gather_signals` just returns whatever unused signals already exist in the DB, so the
ritual is runnable end-to-end and Phase 4 is a drop-in.
"""
from typing import List

from .. import config, repo


def gather_signals(conn) -> List[dict]:
    rows = repo.unused_signals(conn, config.MAX_SIGNALS_PER_RUN)
    return [dict(r) for r in rows]
