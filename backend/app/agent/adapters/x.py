"""X / Twitter social-pulse adapter — ToS-gray, fully key-gated.

Accessing X programmatically needs a paid API or a third-party provider, and the terms are
a moving target. So this adapter is a stub behind `INFINITUM_X_KEY`: with no key it logs a
skip and returns `[]`. The HTTP scaffold is here so a real provider drops in without touching
the scanner — point `INFINITUM_X_API_URL` at it and parse the response below.
"""
import logging
from typing import List

from . import SignalItem
from ... import config

log = logging.getLogger(__name__)


class XAdapter:
    name = "x"

    def fetch(self) -> List[SignalItem]:
        key = config.X_KEY
        if not key:
            log.info("x adapter: no INFINITUM_X_KEY set — skipping (ToS-gray, opt-in only)")
            return []

        endpoint = config.X_API_URL
        if not endpoint:
            log.info("x adapter: key present but no INFINITUM_X_API_URL configured — skipping")
            return []

        import httpx

        # Swap seam: shape the request/response for whatever provider the key belongs to.
        resp = httpx.get(
            endpoint,
            timeout=config.HTTP_TIMEOUT,
            headers={
                "Authorization": f"Bearer {key}",
                "User-Agent": config.HTTP_USER_AGENT,
            },
            params={"query": config.X_QUERY, "max_results": config.ADAPTER_MAX_RESULTS},
        )
        resp.raise_for_status()
        data = resp.json()

        items: List[SignalItem] = []
        for post in data.get("data", []):
            text = " ".join((post.get("text") or "").split()).strip()
            pid = post.get("id") or ""
            url = f"https://x.com/i/web/status/{pid}" if pid else ""
            if not (text or url):
                continue
            title = text[:120]
            items.append(SignalItem(self.name, url, title, text))
        log.info("x adapter: %d items", len(items))
        return items
