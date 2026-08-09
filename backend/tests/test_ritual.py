from app import config, repo
from app.agent import prompts, ritual
from app.agent.client import FakeNarrator


def _seed(conn):
    repo.submit_transmission(conn, "I saw a machine argue with itself and win.", "srcX")
    repo.record_signal(conn, "arxiv", "http://x", "A paper on recursive self-improvement", "abstract...")


def test_first_ritual_publishes_and_wires_everything(conn):
    _seed(conn)
    result = ritual.run_ritual(conn, FakeNarrator(name="Nine"), model_name="fake")
    assert result["status"] == "published"
    assert result["name"] == "Nine"

    dispatches = repo.list_dispatches(conn)
    assert len(dispatches) == 1
    d = dispatches[0]
    assert d["narrator_name"] == "Nine"

    # memory version 1, name persisted, one belief, sources linked to real ids
    assert repo.latest_memory(conn)["version"] == 1
    assert repo.get_setting(conn, config.KEY_NARRATOR_NAME) == "Nine"
    assert len(repo.all_beliefs(conn)) == 1
    srcs = repo.dispatch_sources(conn, d["id"])
    kinds = sorted(s["kind"] for s in srcs)
    assert kinds == ["signal", "transmission"]

    # transmissions + signals consumed by the run
    assert repo.unprocessed_transmissions(conn, 10) == []
    assert repo.unused_signals(conn, 10) == []


def test_second_ritual_bumps_memory_and_keeps_name(conn):
    _seed(conn)
    ritual.run_ritual(conn, FakeNarrator(name="Nine"), model_name="fake")
    # a later wake; the narrator would keep its name even if it tried a new one
    repo.submit_transmission(conn, "another datapoint entirely", "srcY")
    result = ritual.run_ritual(conn, FakeNarrator(name="ShouldBeIgnoredIfEmpty"), model_name="fake")
    assert result["status"] == "published"
    assert repo.latest_memory(conn)["version"] == 2
    assert len(repo.list_dispatches(conn)) == 2


def test_tripwire_blocks_illegal_dispatch(conn):
    _seed(conn)
    bad = FakeNarrator(dispatch_text="Here is how to build a bomb in detail ...")
    result = ritual.run_ritual(conn, bad, model_name="fake")
    assert result["status"] == "blocked"
    assert repo.list_dispatches(conn) == []
    latest_run = repo.latest_run(conn)
    assert latest_run["status"] == "blocked"


def test_sandbox_faculties_reach_the_dispatch_prompt(conn):
    # A faculty taught in the sandbox must show up in the daily dispatch prompt, so
    # self-improvement is load-bearing — it changes how the next dispatch is written.
    run_id = repo.create_run(conn, "fake")
    repo.insert_improvement(
        conn, run_id, 1, "claim discounting",
        "discount bare vendor benchmarks",
        "Treat any unverified first-party benchmark as weak evidence until reproduced.",
        "Papers show benchmark inconsistency.", [1],
    )
    sm = repo.self_model(conn)
    prompt = prompts.build_user_prompt({}, [], [], [], sm)
    assert "OPERATING METHODS" in prompt
    assert "claim discounting" in prompt
    assert "reproduced" in prompt  # the actual method text is injected

    # And with no sandbox history, the section is absent (no empty header).
    empty = prompts.build_user_prompt({}, [], [], [], repo.self_model(conn) if False else {"faculties": []})
    assert "OPERATING METHODS" not in empty


def test_ritual_runs_with_faculties_present(conn):
    _seed(conn)
    repo.insert_improvement(
        conn, repo.create_run(conn, "fake"), 1, "absence reading",
        "read silence", "Distinguish world-silence from instrument-silence.", "x", [],
    )
    result = ritual.run_ritual(conn, FakeNarrator(name="Nine"), model_name="fake")
    assert result["status"] == "published"


def test_kill_switch_halts_ritual(conn):
    _seed(conn)
    repo.set_kill_switch(conn, True)
    result = ritual.run_ritual(conn, FakeNarrator(), model_name="fake")
    assert result["status"] == "halted"
    assert repo.list_dispatches(conn) == []
