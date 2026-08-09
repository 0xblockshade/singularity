"""Manual controls for development.

    python -m app.cli init            # create the database
    python -m app.cli seed-signal ... # drop a test world-signal in
    python -m app.cli run             # run ONE live ritual (needs ANTHROPIC_API_KEY)
    python -m app.cli run --fake      # run ONE ritual with the deterministic narrator

The daily autonomous scheduler is wired in Phase 6; this is how we tune the persona first.
"""
import argparse
import json

from . import config, db, repo
from .agent import client as narrator_client
from .agent import ritual
from .agent import scanning


def main():
    ap = argparse.ArgumentParser(prog="app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("init")

    p_sig = sub.add_parser("seed-signal")
    p_sig.add_argument("--adapter", default="manual")
    p_sig.add_argument("--title", default="")
    p_sig.add_argument("--summary", default="")
    p_sig.add_argument("--url", default="")

    p_run = sub.add_parser("run")
    p_run.add_argument("--fake", action="store_true", help="use the deterministic narrator")

    sub.add_parser("scan")

    args = ap.parse_args()
    conn = db.connect()
    db.init_db(conn)

    if args.cmd == "init":
        print(f"initialized {config.DB_PATH}")

    elif args.cmd == "seed-signal":
        sid = repo.record_signal(conn, args.adapter, args.url, args.title, args.summary)
        print(f"recorded signal {sid}")

    elif args.cmd == "run":
        if args.fake:
            narrator = narrator_client.FakeNarrator()
            result = ritual.run_ritual(conn, narrator, model_name="fake")
        else:
            narrator = narrator_client.AnthropicNarrator()
            result = ritual.run_ritual(conn, narrator)
        print(json.dumps(result, indent=2))

    elif args.cmd == "scan":
        counts = scanning.scan(conn)
        total = sum(counts.values())
        for name, n in counts.items():
            print(f"{name:>8}: {n} recorded")
        print(f"{'total':>8}: {total} recorded")

    conn.close()


if __name__ == "__main__":
    main()
