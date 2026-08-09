"""The daily ritual — the eight steps from DESIGN.md §2.

wake → recall → absorb → scan → synthesize → publish → evolve → attribute.

`run_ritual` is pure orchestration over repo + a narrator client, so it runs identically
under the live AnthropicNarrator and the test FakeNarrator.
"""
import json
from typing import Optional

from .. import config, repo
from . import prompts, publish, safety, scanning


def run_ritual(conn, narrator, model_name: Optional[str] = None) -> dict:
    model_name = model_name or getattr(narrator, "model", "fake")

    # Respect the kill-switch — autonomy has an off-ramp (DESIGN.md §5).
    if repo.kill_switch_on(conn):
        return {"status": "halted", "reason": "kill_switch"}

    # 1. WAKE
    run_id = repo.create_run(conn, model_name)

    try:
        # 2. RECALL — load the mind so far: memory, belief graph, and the self-taught
        #    faculties from the sandbox (so its self-improvement steers today's writing).
        mem_row = repo.latest_memory(conn)
        memory = json.loads(mem_row["state_json"]) if mem_row else {}
        beliefs = [dict(b) for b in repo.all_beliefs(conn)]
        self_model = repo.self_model(conn)

        # 3. ABSORB — every unprocessed transmission, raw.
        tx_rows = repo.unprocessed_transmissions(conn, config.MAX_TRANSMISSIONS_PER_RUN)
        transmissions = [dict(t) for t in tx_rows]

        # 4. SCAN — world signals (Phase 4 fills the adapters).
        signals = scanning.gather_signals(conn)

        # 5. SYNTHESIZE — the narrator writes, unedited.
        user = prompts.build_user_prompt(memory, beliefs, transmissions, signals, self_model)
        data, (in_tok, out_tok) = narrator.narrate(prompts.SYSTEM, user)

        name = (data.get("name") or memory.get("name") or "Unnamed").strip()
        title = data["title"].strip()
        dispatch_body = data["dispatch"]

        # 6. PUBLISH — but the tripwire gates clear illegality first (not opinion).
        ok, reason = safety.output_tripwire(dispatch_body)
        if not ok:
            repo.finish_run(conn, run_id, "blocked", in_tok, out_tok, note=reason)
            return {"status": "blocked", "run_id": run_id, "reason": reason}

        dispatch_id = repo.insert_dispatch(conn, run_id, title, dispatch_body, model_name, name)

        # 7. EVOLVE — persist the name, the new worldview, and the belief graph.
        repo.set_setting(conn, config.KEY_NARRATOR_NAME, name)
        repo.insert_memory_version(conn, run_id, name, data["memory_state"], data["change_summary"])
        for b in data.get("belief_updates", []):
            try:
                conf = float(b.get("confidence", 0.5))
            except (TypeError, ValueError):
                conf = 0.5
            conf = max(0.0, min(1.0, conf))
            repo.upsert_belief(conn, b["concept"].strip(), b["stance"].strip(), conf, run_id)

        # 8. ATTRIBUTE — link the dispatch to the evidence it cited (validated against
        #    what we actually fed it, so a hallucinated id can't create a phantom source).
        valid_tx = {t["id"] for t in transmissions}
        valid_sig = {s["id"] for s in signals}
        for tid in data.get("cited_transmissions", []):
            if tid in valid_tx:
                repo.insert_source(conn, dispatch_id, "transmission", tid)
        for sid in data.get("cited_signals", []):
            if sid in valid_sig:
                repo.insert_source(conn, dispatch_id, "signal", sid)

        repo.mark_transmissions_processed(conn, [t["id"] for t in transmissions], run_id)
        repo.mark_signals_used(conn, [s["id"] for s in signals], run_id)

        repo.finish_run(conn, run_id, "published", in_tok, out_tok)

        # 9. SYNDICATE — best-effort post to X (or any enabled channel). Never breaks
        #    the wake; a failure is logged to `publications` and the dispatch still stands.
        syndication = publish.publish_dispatch(conn, dispatch_id, title)

        return {
            "status": "published",
            "run_id": run_id,
            "dispatch_id": dispatch_id,
            "name": name,
            "syndication": syndication,
        }

    except Exception as exc:  # noqa: BLE001 — record any failure against the run, then re-raise
        repo.finish_run(conn, run_id, "error", note=str(exc)[:500])
        raise
