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

# Settings keys stored in the DB.
KEY_KILL_SWITCH = "kill_switch"        # "1" halts autonomous publishing
KEY_NARRATOR_NAME = "narrator_name"    # set on first run when the agent names itself
