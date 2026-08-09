"""arXiv adapter — the most recent cs.AI / cs.LG submissions via the public Atom API.

No API key. The feed is Atom, so feedparser handles it directly.
"""
import logging
from typing import List

from . import SignalItem
from ... import config

log = logging.getLogger(__name__)

ARXIV_URL = (
    "http://export.arxiv.org/api/query"
    "?search_query=cat:cs.AI+OR+cat:cs.LG"
    "&sortBy=submittedDate&sortOrder=descending&max_results=15"
)


class ArxivAdapter:
    name = "arxiv"

    def fetch(self) -> List[SignalItem]:
        import httpx
        import feedparser

        resp = httpx.get(
            ARXIV_URL,
            timeout=config.HTTP_TIMEOUT,
            headers={"User-Agent": config.HTTP_USER_AGENT},
            follow_redirects=True,
        )
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)

        items: List[SignalItem] = []
        for entry in feed.entries[: config.ADAPTER_MAX_RESULTS]:
            title = " ".join((entry.get("title") or "").split()).strip()
            summary = " ".join((entry.get("summary") or "").split()).strip()
            url = entry.get("link") or ""
            if not (title or url):
                continue
            items.append(SignalItem(self.name, url, title, summary))
        log.info("arxiv adapter: %d items", len(items))
        return items
