from app import config, repo


def test_transmission_dedup_and_rate_flags(conn):
    r1 = repo.submit_transmission(conn, "hello world", "srcA")
    assert r1["flagged"] == 0
    # identical body from anyone within the window is flagged duplicate (still stored)
    r2 = repo.submit_transmission(conn, "hello world", "srcB")
    assert r2["flagged"] == 1 and r2["flag_reason"] == "duplicate"
    assert repo.get_setting(conn, "nope") is None


def test_rate_limit_flag(conn):
    for _ in range(config.RATE_LIMIT_PER_HOUR):
        repo.submit_transmission(conn, "spam text unique enough", "flooder")
    over = repo.submit_transmission(conn, "one more from the flooder", "flooder")
    assert over["flagged"] == 1 and over["flag_reason"] == "rate_limited"


def test_memory_versions_increment(conn):
    run_id = repo.create_run(conn, "fake")
    repo.insert_memory_version(conn, run_id, "Nine", "worldview one", "born")
    repo.insert_memory_version(conn, run_id, "Nine", "worldview two", "grew")
    latest = repo.latest_memory(conn)
    assert latest["version"] == 2
    assert len(repo.list_memory(conn)) == 2


def test_belief_upsert_tracks_change(conn):
    run1 = repo.create_run(conn, "fake")
    repo.upsert_belief(conn, "acceleration", "steepening", 0.4, run1)
    run2 = repo.create_run(conn, "fake")
    repo.upsert_belief(conn, "acceleration", "sharply steepening", 0.6, run2)
    b = repo.all_beliefs(conn)[0]
    assert b["concept"] == "acceleration"
    assert b["first_seen_run"] == run1
    assert b["last_changed_run"] == run2


def test_kill_switch(conn):
    assert repo.kill_switch_on(conn) is False
    repo.set_kill_switch(conn, True)
    assert repo.kill_switch_on(conn) is True
