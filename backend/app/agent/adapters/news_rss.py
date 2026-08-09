"""News / lab-blog RSS adapter.

Pulls a handful of AI-and-tech feeds plus one frontier-lab blog. The feed list is a plain
constant so it is trivial to edit. Each feed is fetched independently — one dead feed never
sinks the rest.
"""
import logging
from typing import List

from . import SignalItem
from ... import config

log = logging.getLogger(__name__)

# Editable feed list. A couple of well-known AI/ML news outlets plus a frontier-lab blog.
NEWS_FEEDS = [
    "https://www.technologyreview.com/topic/artificial-intelligence/feed",  # MIT Tech Review — AI
    "https://feeds.arstechnica.com/arstechnica/technology-lab",             # Ars Technica — tech lab
    "https://openai.com/blog/rss.xml",                                       # OpenAI lab blog
    "https://deepmind.google/blog/rss.xml",                                  # Google DeepMind blog
]


class NewsRSSAdapter:
    name = "news"
    feeds = NEWS_FEEDS

    def fetch(self) -> List[SignalItem]:
        import httpx
        import feedparser

        items: List[SignalItem] = []
        for feed_url in self.feeds:
            try:
                resp = httpx.get(
                    feed_url,
                    timeout=config.HTTP_TIMEOUT,
                    headers={"User-Agent": config.HTTP_USER_AGENT},
                    follow_redirects=True,
                )
                resp.raise_for_status()
                parsed = feedparser.parse(resp.content)
                for entry in parsed.entries[: config.ADAPTER_MAX_RESULTS]:
                    title = " ".join((entry.get("title") or "").split()).strip()
                    raw_summary = entry.get("summary") or entry.get("description") or ""
                    summary = " ".join(raw_summary.split()).strip()
                    url = entry.get("link") or ""
                    if not (title or url):
                        continue
                    items.append(SignalItem(self.name, url, title, summary))
            except Exception as exc:  # noqa: BLE001 — one bad feed must not sink the adapter
                log.warning("news feed failed %s: %s", feed_url, exc)
        log.info("news adapter: %d items", len(items))
        return items
