"""Autonomy — the daily wake.

The narrator is not triggered by a human. A scheduler fires `wake()` once a day; the
ritual itself (`app.agent.ritual.run_ritual`) checks the kill-switch, records a run, and
publishes. This module only decides *when* to wake and *how* to build the narrator.

Two ways to run it:

  * In-process — FastAPI starts `build_scheduler()` on boot when
    ``SINGULARITY_ENABLE_SCHEDULER`` is truthy (one always-on machine does API + wake).
  * Standalone — ``python -m app.scheduler`` runs a blocking scheduler as its own worker
    process. ``python -m app.scheduler --now`` fires a single wake and exits (cron-style
    deploys, and CI wiring checks with ``SINGULARITY_FAKE=1``).

Every env var this module reads is read here directly, with a safe default.
"""
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from . import db
from .agent import ritual

log = logging.getLogger("singularity.scheduler")

JOB_ID = "daily-wake"


def _truthy(val: str) -> bool:
    return str(val).strip().lower() in {"1", "true", "yes", "on"}


def _wake_hour() -> int:
    try:
        return int(os.environ.get("SINGULARITY_WAKE_HOUR", "9"))
    except ValueError:
        log.warning("SINGULARITY_WAKE_HOUR is not an int; falling back to 9")
        return 9


def _timezone() -> str:
    return os.environ.get("SINGULARITY_TZ", "UTC")


def _jitter() -> int:
    """Optional +/- seconds of randomised delay so the wake isn't a perfectly sharp edge."""
    try:
        return int(os.environ.get("SINGULARITY_WAKE_JITTER", "0"))
    except ValueError:
        return 0


def _build_narrator():
    """Pick the narrator for a wake.

    ``SINGULARITY_FAKE=1`` forces the deterministic FakeNarrator (no network, no key) —
    used for wiring checks and dry runs. Otherwise we need ``ANTHROPIC_API_KEY``; if it's
    missing we return None so `wake()` can skip cleanly instead of crashing the process.
    """
    if _truthy(os.environ.get("SINGULARITY_FAKE", "")):
        from .agent.client import FakeNarrator

        log.info("SINGULARITY_FAKE set — using FakeNarrator for this wake")
        return FakeNarrator()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        log.warning("ANTHROPIC_API_KEY is not set — skipping wake (no live narrator available)")
        return None

    from .agent.client import AnthropicNarrator

    return AnthropicNarrator()


def wake(narrator=None) -> dict:
    """Run one daily ritual. Never raises — a failed wake logs and returns a status dict.

    `narrator` can be injected (tests); otherwise it's built from the environment.
    """
    log.info("wake: opening connection and starting ritual")
    conn = None
    try:
        if narrator is None:
            narrator = _build_narrator()
            if narrator is None:
                return {"status": "skipped", "reason": "no_narrator"}

        conn = db.connect()
        db.init_db(conn)  # CREATE IF NOT EXISTS — safe, and covers a fresh volume
        model_name = os.environ.get("SINGULARITY_NARRATOR_MODEL") or None
        result = ritual.run_ritual(conn, narrator, model_name=model_name)
        log.info("wake: ritual finished: %s", result)
        return result
    except Exception:  # noqa: BLE001 — a failed wake must never take down the process
        log.exception("wake: ritual failed")
        return {"status": "error"}
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:  # noqa: BLE001
                log.exception("wake: failed to close connection")


def build_scheduler() -> BackgroundScheduler:
    """A BackgroundScheduler with exactly one daily-wake cron job.

    BackgroundScheduler runs the job in its own thread, which suits the synchronous
    SQLite ritual and lets it live happily beside FastAPI's async loop.
    """
    hour = _wake_hour()
    tz = _timezone()
    jitter = _jitter()

    scheduler = BackgroundScheduler(timezone=tz)
    trigger = CronTrigger(hour=hour, minute=0, timezone=tz, jitter=jitter or None)
    scheduler.add_job(
        wake,
        trigger=trigger,
        id=JOB_ID,
        name="daily narrator wake",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    log.info("scheduler built: daily wake at %02d:00 %s (jitter=%ss)", hour, tz, jitter)
    return scheduler


def main(argv=None) -> int:
    import argparse

    logging.basicConfig(
        level=os.environ.get("SINGULARITY_LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    parser = argparse.ArgumentParser(description="singularity daily-wake scheduler")
    parser.add_argument(
        "--now",
        action="store_true",
        help="fire a single wake immediately and exit (cron-style / wiring check)",
    )
    args = parser.parse_args(argv)

    if args.now:
        result = wake()
        log.info("one-shot wake result: %s", result)
        # Exit non-zero only on hard failure; halted/blocked/skipped are valid outcomes.
        return 0 if result.get("status") != "error" else 1

    scheduler = build_scheduler()
    scheduler.start()
    log.info("scheduler started; running until interrupted (Ctrl-C)")
    try:
        import time

        while True:
            time.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        log.info("shutting down scheduler")
        scheduler.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
