"""Swappable signal adapters.

Each adapter is a tiny object with a `name: str` and a `fetch() -> list[SignalItem]`.
Adapters that need a key (web search, X) self-gate: absent the key they log a skip and
return `[]` rather than crash. Adapters that hit the public web (arXiv, news RSS, Reddit)
are best-effort — any failure is caught upstream in `scanning.run_adapters`.

`enabled_adapters()` is the registry the scanner iterates. Reorder / trim it to change what
the narrator sees; the ToS-gray social sources sit behind this seam so they swap cleanly.
"""
from dataclasses import dataclass
from typing import List, Protocol, runtime_checkable


@dataclass
class SignalItem:
    """One world-signal, before it is scored and written to the `signals` table."""
    adapter: str
    url: str
    title: str
    summary: str


@runtime_checkable
class Adapter(Protocol):
    name: str

    def fetch(self) -> List["SignalItem"]:
        ...


# Adapter classes are imported AFTER SignalItem exists so the modules can do
# `from . import SignalItem` without a circular-import stall.
from .arxiv import ArxivAdapter          # noqa: E402
from .news_rss import NewsRSSAdapter      # noqa: E402
from .web import WebSearchAdapter         # noqa: E402
from .reddit import RedditAdapter         # noqa: E402
from .x import XAdapter                   # noqa: E402


def enabled_adapters() -> List[Adapter]:
    """The adapters the scanner runs, in priority order. Key-gated adapters stay in the
    list and no-op when their key is absent, so enabling one is purely an env change."""
    return [
        ArxivAdapter(),
        NewsRSSAdapter(),
        RedditAdapter(),
        WebSearchAdapter(),
        XAdapter(),
    ]


__all__ = [
    "SignalItem",
    "Adapter",
    "enabled_adapters",
    "ArxivAdapter",
    "NewsRSSAdapter",
    "WebSearchAdapter",
    "RedditAdapter",
    "XAdapter",
]
