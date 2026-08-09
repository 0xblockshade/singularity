"""Off-site syndication of a dispatch.

Right now the one channel is X (Twitter), via the official API v2 with OAuth 1.0a
user context — the free tier can WRITE, which is all we need to post. The four tokens
come from the environment (X developer portal), never from the repo.

Design mirrors the scan adapters: a swappable publisher behind a small interface, gated
on env, best-effort. `publish_dispatch` never raises — a failed post is logged to the
`publications` table and the wake continues. Dispatches are long-form markdown, so a post
is the title plus a link back to the full dispatch on the site.
"""
from typing import Optional, Tuple

from .. import config, repo

X_CHANNEL = "x"
TWEET_LIMIT = 280
TCO_LEN = 23  # X counts every URL as 23 chars regardless of real length


def format_dispatch_for_x(title: str, dispatch_id: int) -> str:
    """Title + a link to the full dispatch, trimmed to fit a single post."""
    title = (title or "").strip()
    link = f"{config.PUBLIC_URL}/dispatches/{dispatch_id}" if config.PUBLIC_URL else ""

    if link:
        budget = TWEET_LIMIT - TCO_LEN - 2  # 2 for the "\n\n" separator
        if len(title) > budget:
            title = title[: budget - 1].rstrip() + "…"
        return f"{title}\n\n{link}"

    if len(title) > TWEET_LIMIT:
        title = title[: TWEET_LIMIT - 1].rstrip() + "…"
    return title


class XPublisher:
    """Posts to X via the official API v2. Lazily imports tweepy so the app and its
    tests don't need it unless X publishing is actually enabled."""

    channel = X_CHANNEL

    def available(self) -> bool:
        return bool(
            config.X_API_KEY
            and config.X_API_SECRET
            and config.X_ACCESS_TOKEN
            and config.X_ACCESS_SECRET
        )

    def post(self, text: str) -> Tuple[str, str]:
        import tweepy  # lazy

        client = tweepy.Client(
            consumer_key=config.X_API_KEY,
            consumer_secret=config.X_API_SECRET,
            access_token=config.X_ACCESS_TOKEN,
            access_token_secret=config.X_ACCESS_SECRET,
        )
        resp = client.create_tweet(text=text)
        tweet_id = str(resp.data["id"])
        return tweet_id, f"https://x.com/i/web/status/{tweet_id}"


def publish_dispatch(conn, dispatch_id: int, title: str, publisher=None) -> dict:
    """Best-effort post of one dispatch to its channel. Never raises.

    Returns {"status": disabled|skipped|already_posted|posted|error, ...}. Records a
    row in `publications` for every real attempt (posted / error / skipped-misconfig)."""
    pub = publisher or XPublisher()
    channel = getattr(pub, "channel", X_CHANNEL)

    # An injected publisher (tests) is always exercised; the real one only when enabled.
    if publisher is None and not config.PUBLISH_X:
        return {"status": "disabled"}

    if not pub.available():
        repo.record_publication(conn, dispatch_id, channel, "skipped", error="missing_credentials")
        return {"status": "skipped", "reason": "missing_credentials"}

    if repo.already_posted(conn, dispatch_id, channel):
        return {"status": "already_posted"}

    text = format_dispatch_for_x(title, dispatch_id)
    try:
        external_id, url = pub.post(text)
        repo.record_publication(conn, dispatch_id, channel, "posted", external_id=external_id, url=url)
        return {"status": "posted", "channel": channel, "external_id": external_id, "url": url}
    except Exception as exc:  # noqa: BLE001 — syndication must never break a wake
        repo.record_publication(conn, dispatch_id, channel, "error", error=str(exc)[:500])
        return {"status": "error", "channel": channel, "error": str(exc)[:200]}
