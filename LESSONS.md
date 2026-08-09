# singularity — Lessons

Project-specific context that doesn't generalise. Written by `/retro`, editable by hand.
Read this before writing code. If a lesson is wrong, fix the file — don't work around it.

## Decisions locked with the user
- **Fully autonomous auto-publish** from launch. "No human edits, no approval" is the soul of the piece.
- **Signals scanned:** web + AI research + news **and** social pulse (X/Reddit). Social is ToS-gray — keep
  every source behind a swappable adapter.
- **Raw firehose inbox** — public transmissions reach the agent unfiltered; it self-filters. Hardening lives
  in the agent (injection resistance) + an output tripwire + rate limits, NOT in editing its voice.
- **Budget:** quality over cost. Opus-class model narrates the daily dispatch; cheap models triage scanning.
- The agent **names itself** on first run and may change its mind in public — both are part of the artwork.

## Rejected
<!-- Approaches turned down, and why. -->

## Mistakes to not repeat
<!-- Concrete failures. Root cause + what to do instead. -->

## Stack notes
- Confirm exact current Claude model IDs against the `claude-api` skill at build time — do not hardcode from
  memory.
- **Live scanning is opt-in.** `gather_signals` only fetches when `SINGULARITY_LIVE_SCAN` is truthy; otherwise
  it returns cached unused signals. Keeps tests offline/deterministic and lets a wake degrade to cached signals
  if the network dies. Each adapter runs in its own try/except so one dead source never kills a wake.
- **Adapters:** `arxiv`, `news`, `reddit` are live with no key. `web` (Tavily via `SINGULARITY_WEBSEARCH_KEY`)
  and `x` (`SINGULARITY_X_KEY`, ToS-gray) self-skip to `[]` when their key is absent — never crash.
- **Scheduler is flag-gated.** FastAPI only starts the in-process daily wake when `SINGULARITY_ENABLE_SCHEDULER`
  is truthy (default OFF). Run standalone with `python -m app.scheduler` (worker) or `--now` (one-shot).
  `SINGULARITY_FAKE=1` forces the deterministic narrator for wiring tests — no network, no key.
- **`.env.example` must be force-tracked.** The `.env.*` ignore rule silently swallows the template; the repo
  carries `!.env.example` / `!**/.env.example` negations. Don't remove them.
- **Frontend fixtures are placeholders, marked for deletion** in `frontend/src/lib/fixtures.ts`. The sample
  narrator ("Kestrel", model `claude-opus-4`) is invented — the model ID there is a stand-in; swap to the real
  one at launch and delete fixtures once the agent has published real dispatches.

## Build notes (Phases 4–7, 2026-08-09)
- Phases 4/5/6 were built by three parallel subagents split by surface (signal ingestion / frontend / deploy),
  disjoint file sets, then merged and verified by the lead. Backend: **24 tests pass**; frontend `npm run build`
  + `tsc --noEmit` clean; one-shot fake wake publishes exit 0. Nothing has run against the real Claude API yet
  and nothing is deployed — going live needs the user's key + accounts + explicit go.
- The belief graph is a hand-rolled canvas force-constellation — **no graph library**, keeps the bundle self-
  contained. The single frontend data boundary is `src/lib/api.ts` (`Sourced<T>`, empty-or-unreachable → fixtures).
