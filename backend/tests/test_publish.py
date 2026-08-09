from app import config, repo
from app.agent import publish


class FakePublisher:
    channel = "x"

    def __init__(self, ok=True):
        self.ok = ok
        self.calls = 0

    def available(self):
        return True

    def post(self, text):
        self.calls += 1
        if not self.ok:
            raise RuntimeError("boom from X")
        return "12345", "https://x.com/i/web/status/12345"


def _make_dispatch(conn, title="A Title"):
    run_id = repo.create_run(conn, "fake")
    return repo.insert_dispatch(conn, run_id, title, "body", "fake", "Nine")


def test_format_plain_and_with_link(monkeypatch):
    monkeypatch.setattr(config, "PUBLIC_URL", "")
    long_title = "x" * 400
    assert len(publish.format_dispatch_for_x(long_title, 1)) <= publish.TWEET_LIMIT

    monkeypatch.setattr(config, "PUBLIC_URL", "https://singularity.example")
    text = publish.format_dispatch_for_x("Day One", 7)
    assert "https://singularity.example/dispatches/7" in text
    assert text.startswith("Day One")


def test_posts_and_prevents_double_post(conn):
    did = _make_dispatch(conn)
    pub = FakePublisher()
    r1 = publish.publish_dispatch(conn, did, "A Title", publisher=pub)
    assert r1["status"] == "posted" and r1["external_id"] == "12345"
    assert repo.already_posted(conn, did, "x") is True

    # second attempt is a no-op — no second call, no duplicate posted row
    r2 = publish.publish_dispatch(conn, did, "A Title", publisher=pub)
    assert r2["status"] == "already_posted"
    assert pub.calls == 1
    posted = [p for p in repo.dispatch_publications(conn, did) if p["status"] == "posted"]
    assert len(posted) == 1


def test_error_is_logged_not_raised(conn):
    did = _make_dispatch(conn)
    r = publish.publish_dispatch(conn, did, "A Title", publisher=FakePublisher(ok=False))
    assert r["status"] == "error"
    rows = repo.dispatch_publications(conn, did)
    assert rows and rows[0]["status"] == "error" and "boom" in (rows[0]["error"] or "")
    assert repo.already_posted(conn, did, "x") is False


def test_disabled_when_no_publisher_and_flag_off(conn, monkeypatch):
    monkeypatch.setattr(config, "PUBLISH_X", False)
    did = _make_dispatch(conn)
    r = publish.publish_dispatch(conn, did, "A Title")  # no injected publisher
    assert r["status"] == "disabled"
    assert repo.dispatch_publications(conn, did) == []


def test_missing_credentials_is_skipped(conn, monkeypatch):
    # Real XPublisher with no tokens → available() False → skipped + logged.
    for key in ("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"):
        monkeypatch.setattr(config, key, "")
    did = _make_dispatch(conn)
    r = publish.publish_dispatch(conn, did, "A Title", publisher=publish.XPublisher())
    assert r["status"] == "skipped"
    assert repo.dispatch_publications(conn, did)[0]["status"] == "skipped"
