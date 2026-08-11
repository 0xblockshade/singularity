"""Scan-layer tests. No network: adapters are monkeypatched with in-memory fakes."""
from app import repo
from app.agent import scanning
from app.agent.adapters import SignalItem


class FakeAdapter:
    """Returns a fixed list of SignalItems."""

    def __init__(self, name, items):
        self.name = name
        self._items = items

    def fetch(self):
        return list(self._items)


class RaisingAdapter:
    name = "boom"

    def fetch(self):
        raise RuntimeError("network down")


def test_raising_adapter_does_not_break_scan(conn, monkeypatch):
    good = FakeAdapter(
        "fake",
        [
            SignalItem("fake", "http://a", "AGI breakthrough at frontier lab", "..."),
            SignalItem("fake", "http://b", "A quiet update", "nothing much"),
        ],
    )
    monkeypatch.setattr(scanning, "enabled_adapters", lambda: [RaisingAdapter(), good])

    recorded = scanning.run_adapters(conn)

    # The raising adapter is swallowed; the good adapter still lands both items.
    assert recorded == 2
    assert len(repo.unused_signals(conn, 60)) == 2


def test_run_adapters_records_then_dedupes(conn, monkeypatch):
    items = [
        SignalItem("fake", "http://a", "AGI news", "x"),
        SignalItem("fake", "http://b", "other thing", "y"),
    ]
    monkeypatch.setattr(scanning, "enabled_adapters", lambda: [FakeAdapter("fake", items)])

    assert scanning.run_adapters(conn) == 2
    # Second run sees the same urls/titles already stored → nothing new recorded.
    assert scanning.run_adapters(conn) == 0
    assert len(repo.unused_signals(conn, 60)) == 2


def test_gather_signals_offline_makes_no_network_call(conn, monkeypatch):
    monkeypatch.delenv("INFINITUM_LIVE_SCAN", raising=False)

    def explode():
        raise AssertionError("adapters must not run when live scan is off")

    monkeypatch.setattr(scanning, "enabled_adapters", explode)
    repo.record_signal(conn, "manual", "http://seed", "seeded signal", "s", salience=0.5)

    out = scanning.gather_signals(conn)

    assert isinstance(out, list)
    assert len(out) == 1
    assert isinstance(out[0], dict)
    assert out[0]["title"] == "seeded signal"


def test_gather_signals_live_triggers_scan(conn, monkeypatch):
    monkeypatch.setenv("INFINITUM_LIVE_SCAN", "1")
    items = [SignalItem("fake", "http://live", "live AGI item", "z")]
    monkeypatch.setattr(scanning, "enabled_adapters", lambda: [FakeAdapter("fake", items)])

    out = scanning.gather_signals(conn)

    assert any(r["url"] == "http://live" for r in out)


def test_salience_ranks_agi_above_bland(conn):
    hot = scanning.heuristic_salience(
        "AGI and superintelligence: a frontier benchmark", "recursive self-improvement"
    )
    bland = scanning.heuristic_salience("A calm afternoon", "nothing of note happened")

    assert hot > bland
    assert bland == 0.0
    assert hot <= 1.0
