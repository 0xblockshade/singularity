"""Runtime configuration and tunable constants.

Every knob is a named constant so behaviour is explainable and adjustable. Anything
environment-specific reads from an env var with a sensible default.
"""
import os

APP_DIR = os.path.dirname(os.path.abspath(__file__))          # backend/app
BACKEND_DIR = os.path.dirname(APP_DIR)                        # backend
DATA_DIR = os.environ.get("SINGULARITY_DATA", os.path.join(BACKEND_DIR, "data"))
DB_PATH = os.environ.get("SINGULARITY_DB", os.path.join(DATA_DIR, "singularity.db"))

# Models — confirmed against the claude-api skill (see LESSONS.md). Do not hardcode
# from memory; these are overridable so a model bump is a config change, not a code edit.
NARRATOR_MODEL = os.environ.get("SINGULARITY_NARRATOR_MODEL", "claude-opus-5")
TRIAGE_MODEL = os.environ.get("SINGULARITY_TRIAGE_MODEL", "claude-haiku-4-5")
NARRATOR_MAX_TOKENS = int(os.environ.get("SINGULARITY_MAX_TOKENS", "16000"))

# Inbox guards (metadata only — the agent still reads everything; see DESIGN.md §5).
RATE_LIMIT_PER_HOUR = int(os.environ.get("SINGULARITY_RATE_LIMIT", "30"))
DEDUP_WINDOW_MIN = int(os.environ.get("SINGULARITY_DEDUP_WINDOW_MIN", "60"))
MAX_TRANSMISSION_CHARS = int(os.environ.get("SINGULARITY_MAX_TX_CHARS", "4000"))

# How many signals / transmissions the ritual feeds the narrator per wake.
MAX_SIGNALS_PER_RUN = int(os.environ.get("SINGULARITY_MAX_SIGNALS", "60"))
MAX_TRANSMISSIONS_PER_RUN = int(os.environ.get("SINGULARITY_MAX_TX", "200"))

# Sandbox (recursive self-improvement) loop: how many recent research signals
# (arxiv / news) the agent studies per cycle when revising its own faculties.
SANDBOX_RESEARCH_SIGNALS = int(os.environ.get("SINGULARITY_SANDBOX_SIGNALS", "25"))

# ---------- Phase 4: signal ingestion ----------

def _truthy(val: str) -> bool:
    return (val or "").strip().lower() in ("1", "true", "yes", "on")


def live_scan_enabled() -> bool:
    """Read at call time (not import) so the flag is honoured however it is set. Off by
    default: existing tests stay offline and deterministic unless they opt in."""
    return _truthy(os.environ.get("SINGULARITY_LIVE_SCAN"))


# Per-adapter cap on items pulled per wake. Feed / subreddit lists live in the adapters.
ADAPTER_MAX_RESULTS = int(os.environ.get("SINGULARITY_ADAPTER_MAX", "15"))

# Shared HTTP knobs. Reddit's public JSON and some feeds reject a default UA, so set one.
HTTP_TIMEOUT = float(os.environ.get("SINGULARITY_HTTP_TIMEOUT", "15"))
HTTP_USER_AGENT = os.environ.get(
    "SINGULARITY_USER_AGENT",
    "singularity-narrator/0.1 (autonomous AI-progress observer)",
)

# Key-gated adapters. Absent the key, the adapter cleanly returns [] (never crashes).
WEBSEARCH_KEY = os.environ.get("SINGULARITY_WEBSEARCH_KEY", "")
WEBSEARCH_URL = os.environ.get("SINGULARITY_WEBSEARCH_URL", "https://api.tavily.com/search")
X_KEY = os.environ.get("SINGULARITY_X_KEY", "")
X_API_URL = os.environ.get("SINGULARITY_X_API_URL", "")
X_QUERY = os.environ.get("SINGULARITY_X_QUERY", "AGI OR superintelligence OR frontier model")

# Optional LLM triage of scanned signals with the haiku model. Off by default; degrades to
# the heuristic when disabled or when ANTHROPIC_API_KEY is missing. Never blocks the scan.
TRIAGE_ENABLED = _truthy(os.environ.get("SINGULARITY_TRIAGE"))

# Heuristic salience: keyword -> weight. Summed over title+summary, clamped to 1.0. Tunable.
SALIENCE_KEYWORDS = {
    "superintelligence": 1.0,
    "agi": 1.0,
    "asi": 0.9,
    "self-improv": 0.9,
    "recursive": 0.6,
    "frontier": 0.6,
    "breakthrough": 0.6,
    "emergent": 0.5,
    "benchmark": 0.5,
    "state-of-the-art": 0.5,
    "sota": 0.5,
    "capabilities": 0.5,
    "autonomous": 0.5,
    "reasoning": 0.4,
    "alignment": 0.4,
    "scaling": 0.4,
    "singularity": 0.7,
}

# Off-site syndication — post each dispatch to X (Twitter) via the official API v2,
# OAuth 1.0a user context (free tier can WRITE). All four tokens come from the X
# developer portal and are read from the environment — never stored in the repo.
PUBLISH_X = os.environ.get("SINGULARITY_PUBLISH_X", "").lower() in ("1", "true", "yes", "on")
X_API_KEY = os.environ.get("X_API_KEY", "")
X_API_SECRET = os.environ.get("X_API_SECRET", "")
X_ACCESS_TOKEN = os.environ.get("X_ACCESS_TOKEN", "")
X_ACCESS_SECRET = os.environ.get("X_ACCESS_SECRET", "")
# Public site URL, used to build the link back to the full dispatch in each post.
PUBLIC_URL = os.environ.get("SINGULARITY_PUBLIC_URL", "").rstrip("/")

# Settings keys stored in the DB.
KEY_KILL_SWITCH = "kill_switch"        # "1" halts autonomous publishing
KEY_NARRATOR_NAME = "narrator_name"    # set on first run when the agent names itself
