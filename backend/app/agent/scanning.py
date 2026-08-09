"""Signal gathering — the SCAN step of the daily ritual.

A swappable adapter layer fetches real world-signals about AI progress (arXiv papers, news +
lab-blog RSS, Reddit pulse, and key-gated web-search / X) and writes them into the `signals`
table. `gather_signals` stays the entry point the ritual calls; live scanning is opt-in via
`SINGULARITY_LIVE_SCAN` so offline tests remain deterministic.

Robustness is load-bearing here: each adapter runs inside its own try/except, so one failing
source never kills a wake, and a network failure during a live scan falls back to whatever
signals are already cached.
"""
import logging
from typing import Dict, List

from .. import config, repo
from .adapters import SignalItem, enabled_adapters

log = logging.getLogger(__name__)


# ---------- salience ----------

def heuristic_salience(title: str, summary: str) -> float:
    """Keyword-hit score in [0, 1]. Frontier-progress terms rank a signal up; bland text
    scores near zero. Cheap, deterministic, and always available with no key."""
    text = f"{title or ''} {summary or ''}".lower()
    score = 0.0
    for keyword, weight in config.SALIENCE_KEYWORDS.items():
        if keyword in text:
            score += weight
    return round(min(1.0, score), 3)


def _score(item: SignalItem) -> float:
    return heuristic_salience(item.title, item.summary)


# ---------- dedup ----------

def _existing_index(conn) -> set:
    """Lower-cased url + title of every signal already stored, for cross-run dedup."""
    idx = set()
    for row in conn.execute("SELECT url, title FROM signals"):
        if row["url"]:
            idx.add(row["url"].strip().lower())
        if row["title"]:
            idx.add(row["title"].strip().lower())
    return idx


# ---------- optional LLM triage ----------

def _maybe_triage(items: List[SignalItem]) -> None:
    """Placeholder for haiku-model triage. Enabled only when SINGULARITY_TRIAGE is set AND
    ANTHROPIC_API_KEY is present; any failure is swallowed so the pipeline never blocks. The
    heuristic score is always applied regardless, so triage is purely additive when wired."""
    import os

    if not (config.TRIAGE_ENABLED and os.environ.get("ANTHROPIC_API_KEY")):
        return
    try:
        # Intentionally light: refine salience via TRIAGE_MODEL here when desired. Left as a
        # guarded seam so a model bump or prompt tweak never risks the daily wake.
        log.info("triage: %d items eligible (heuristic salience retained)", len(items))
    except Exception as exc:  # noqa: BLE001 — triage must never break the scan
        log.warning("triage skipped: %s", exc)


# ---------- the scan ----------

def scan(conn) -> Dict[str, int]:
    """Run every enabled adapter once. Returns {adapter_name: signals_recorded}. Each adapter
    is isolated: a raising adapter is logged and contributes 0. Dedupes new items against the
    DB and against each other within this run."""
    existing = _existing_index(conn)
    seen_this_run = set()
    counts: Dict[str, int] = {}

    for adapter in enabled_adapters():
        name = getattr(adapter, "name", adapter.__class__.__name__)
        counts.setdefault(name, 0)
        try:
            items = adapter.fetch()
        except Exception as exc:  # noqa: BLE001 — one bad adapter never kills the scan
            log.warning("adapter %s failed: %s", name, exc)
            continue

        _maybe_triage(items)

        for item in items:
            key_url = (item.url or "").strip().lower()
            key_title = (item.title or "").strip().lower()
            if not (key_url or key_title):
                continue
            if key_url and key_url in existing:
                continue
            if key_title and key_title in existing:
                continue
            dedup_key = key_url or key_title
            if dedup_key in seen_this_run:
                continue

            repo.record_signal(
                conn,
                item.adapter or name,
                item.url,
                item.title,
                item.summary,
                salience=_score(item),
            )
            if key_url:
                existing.add(key_url)
            if key_title:
                existing.add(key_title)
            seen_this_run.add(dedup_key)
            counts[name] += 1

    return counts


def run_adapters(conn) -> int:
    """Run all enabled adapters and return the total number of new signals recorded."""
    return sum(scan(conn).values())


# ---------- ritual entry point ----------

def gather_signals(conn) -> List[dict]:
    """SCAN entry point the ritual calls. If live scanning is enabled, best-effort refresh
    the signal store first (never letting a network failure break a wake), then return the
    unused signals for the narrator. Signature and return shape are unchanged."""
    if config.live_scan_enabled():
        try:
            recorded = run_adapters(conn)
            log.info("live scan recorded %d new signals", recorded)
        except Exception as exc:  # noqa: BLE001 — a failed scan must never break the wake
            log.warning("live scan failed, using cached signals: %s", exc)

    rows = repo.unused_signals(conn, config.MAX_SIGNALS_PER_RUN)
    return [dict(r) for r in rows]
