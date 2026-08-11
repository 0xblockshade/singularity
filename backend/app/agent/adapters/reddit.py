"""Reddit social-pulse adapter — public JSON, no key.

Reddit's public `.json` endpoints need no auth but reject the default client User-Agent, so
we send a custom one. Best-effort: any failure on any subreddit is swallowed and the rest
still return.
"""
import logging
from typing import List

from . import SignalItem
from ... import config

log = logging.getLogger(__name__)

# Editable list of public top-of-day JSON endpoints.
REDDIT_URLS = [
    "__REDDIT_INFINITUM_URL__top.json?t=day&limit=15",
    "https://www.reddit.com/r/MachineLearning/top.json?t=day&limit=15",
]


class RedditAdapter:
    name = "reddit"
    urls = REDDIT_URLS

    def fetch(self) -> List[SignalItem]:
        import httpx

        items: List[SignalItem] = []
        for url in self.urls:
            try:
                resp = httpx.get(
                    url,
                    timeout=config.HTTP_TIMEOUT,
                    headers={"User-Agent": config.HTTP_USER_AGENT},
                    follow_redirects=True,
                )
                resp.raise_for_status()
                data = resp.json()
                children = data.get("data", {}).get("children", [])
                for child in children[: config.ADAPTER_MAX_RESULTS]:
                    d = child.get("data", {})
                    title = " ".join((d.get("title") or "").split()).strip()
                    permalink = d.get("permalink") or ""
                    link = ("https://www.reddit.com" + permalink) if permalink else (d.get("url") or "")
                    summary = " ".join((d.get("selftext") or "").split()).strip()[:1000]
                    if not (title or link):
                        continue
                    items.append(SignalItem(self.name, link, title, summary))
            except Exception as exc:  # noqa: BLE001 — best-effort per subreddit
                log.warning("reddit fetch failed %s: %s", url, exc)
        log.info("reddit adapter: %d items", len(items))
        return items
