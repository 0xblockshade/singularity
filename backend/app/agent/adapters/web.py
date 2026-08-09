"""Web-search adapter.

Requires an API key (`SINGULARITY_WEBSEARCH_KEY`). Implemented against Tavily's search API
by default, but the provider is just this one module — swap it without touching the scanner.

If the key is absent it logs a skip and returns `[]`. It never crashes the scan.
"""
import logging
from typing import List

from . import SignalItem
from ... import config

log = logging.getLogger(__name__)

# Tavily search endpoint. Provider-specific: replace this module to use Brave/SerpAPI/etc.
WEBSEARCH_URL = config.WEBSEARCH_URL
WEBSEARCH_QUERY = (
    "latest AI progress: frontier models, AGI, superintelligence, "
    "new capabilities, benchmark records, alignment"
)


class WebSearchAdapter:
    name = "web"

    def fetch(self) -> List[SignalItem]:
        key = config.WEBSEARCH_KEY
        if not key:
            log.info("web adapter: no SINGULARITY_WEBSEARCH_KEY set — skipping")
            return []

        import httpx

        resp = httpx.post(
            WEBSEARCH_URL,
            json={
                "api_key": key,
                "query": WEBSEARCH_QUERY,
                "topic": "news",
                "max_results": config.ADAPTER_MAX_RESULTS,
            },
            timeout=config.HTTP_TIMEOUT,
            headers={"User-Agent": config.HTTP_USER_AGENT},
        )
        resp.raise_for_status()
        data = resp.json()

        items: List[SignalItem] = []
        for r in data.get("results", []):
            title = " ".join((r.get("title") or "").split()).strip()
            summary = " ".join((r.get("content") or "").split()).strip()
            url = r.get("url") or ""
            if not (title or url):
                continue
            items.append(SignalItem(self.name, url, title, summary))
        log.info("web adapter: %d items", len(items))
        return items
