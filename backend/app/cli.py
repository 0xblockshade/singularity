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
from .agent import publish
from .agent import ritual
from .agent import sandbox
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

    p_sandbox = sub.add_parser("sandbox")
    p_sandbox.add_argument("--fake", action="store_true", help="use the deterministic narrator")

    sub.add_parser("scan")

    p_pub = sub.add_parser("publish", help="post a dispatch to X (needs X_* tokens + --force or SINGULARITY_PUBLISH_X)")
    p_pub.add_argument("--dispatch", type=int, help="dispatch id to post (default: latest)")
    p_pub.add_argument("--force", action="store_true", help="post even if SINGULARITY_PUBLISH_X is off")

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

    elif args.cmd == "sandbox":
        if args.fake:
            narrator = narrator_client.FakeNarrator()
            result = sandbox.run_sandbox(conn, narrator, model_name="fake")
        else:
            narrator = narrator_client.AnthropicNarrator()
            result = sandbox.run_sandbox(conn, narrator)
        print(json.dumps(result, indent=2))

    elif args.cmd == "scan":
        counts = scanning.scan(conn)
        total = sum(counts.values())
        for name, n in counts.items():
            print(f"{name:>8}: {n} recorded")
        print(f"{'total':>8}: {total} recorded")

    elif args.cmd == "publish":
        if args.dispatch:
            d = repo.get_dispatch(conn, args.dispatch)
        else:
            rows = repo.list_dispatches(conn, 1)
            d = rows[0] if rows else None
        if not d:
            print("no such dispatch")
        else:
            # --force lets you post manually without turning on autonomous syndication.
            publisher = publish.XPublisher() if (config.PUBLISH_X or args.force) else None
            if publisher is None:
                print("X publishing is off. Re-run with --force, or set SINGULARITY_PUBLISH_X=1.")
            else:
                result = publish.publish_dispatch(conn, d["id"], d["title"], publisher=publisher)
                print(json.dumps(result, indent=2))

    conn.close()


if __name__ == "__main__":
    main()
