# Deploy & Autonomy Runbook

How the narrator wakes on its own, how to run it locally, and how to ship it to Fly.io or
Railway. Phase 6 covers the scheduler and the deploy artifacts only.

> **Going live needs the user's explicit approval and their own accounts/keys.** A real
> `ANTHROPIC_API_KEY` plus a real deploy is the "mainnet" moment here. Nothing in this repo
> deploys itself. Do not `fly deploy` / `railway up` without an explicit go.

---

## 1. Environment

All config is env vars — see [`backend/.env.example`](../backend/.env.example) for the full
list with defaults. The ones that matter for a deploy:

| Var | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Live narrator. Missing → wake skips (no crash). A secret. |
| `SINGULARITY_ADMIN_TOKEN` | `""` | Guards the kill-switch endpoint. Empty = locked. A secret. |
| `SINGULARITY_ENABLE_SCHEDULER` | `false` | Start the in-process daily wake on app boot. |
| `SINGULARITY_WAKE_HOUR` | `9` | Hour (0–23) of the daily wake, in `SINGULARITY_TZ`. |
| `SINGULARITY_TZ` | `UTC` | IANA timezone for the schedule. |
| `SINGULARITY_WAKE_JITTER` | `0` | Optional ± seconds of randomised fire time. |
| `SINGULARITY_FAKE` | — | Force the FakeNarrator (no network) for a wake. Dry runs only. |
| `SINGULARITY_DATA` | `backend/data` | Data dir — mount a persistent volume here. |
| `SINGULARITY_DB` | `<DATA>/singularity.db` | SQLite path (WAL mode). |
| `SINGULARITY_NARRATOR_MODEL` | `claude-opus-5` | Narrator model override. |
| `PORT` | `8000` | Port uvicorn binds. |

Never commit a real `.env`. Set secrets through the platform (`fly secrets set` /
`railway variables`), not in `fly.toml` / `railway.json`.

---

## 2. Run locally

From `backend/` with the venv active (`source .venv/bin/activate`):

```bash
# API only (no autonomy):
uvicorn app.main:app --reload

# API + in-process daily wake:
SINGULARITY_ENABLE_SCHEDULER=true uvicorn app.main:app
```

The app calls `_ensure_db()` on import, so the schema exists before the first request.

---

## 3. The daily wake

`app/scheduler.py` owns autonomy. A `CronTrigger` fires `wake()` once a day at
`SINGULARITY_WAKE_HOUR:00` in `SINGULARITY_TZ`. `wake()` opens a DB connection, builds a
narrator, runs `app.agent.ritual.run_ritual`, logs the result, and closes the connection.

- It **never raises** — a failed wake logs and returns `{"status": "error"}`; the process
  stays up for tomorrow.
- The **kill-switch** is checked inside the ritual (`{"status": "halted"}`), not here.
- No `ANTHROPIC_API_KEY` and no `SINGULARITY_FAKE` → the wake **skips** with a clear warning.

### Three ways to run it

**a) In-process (recommended for one always-on machine).**
Set `SINGULARITY_ENABLE_SCHEDULER=true`. FastAPI's lifespan starts a `BackgroundScheduler`
on boot and shuts it down cleanly on stop. This is what the Fly/Railway configs use. Run
exactly **one** such machine so the wake doesn't double-fire.

**b) Standalone worker (blocking process).**

```bash
python -m app.scheduler
```

A separate long-running process that only schedules the wake — pair it with an API deployment
that has `SINGULARITY_ENABLE_SCHEDULER` unset.

**c) One-shot (cron-style / CI wiring check).**

```bash
python -m app.scheduler --now                 # one live wake, then exit
SINGULARITY_FAKE=1 python -m app.scheduler --now   # dry run, no network, publishes a fake dispatch
```

Exits `0` on any valid outcome (published / halted / blocked / skipped), `1` on hard error.
Good for an external cron (Fly Machines schedule, Railway cron, GitHub Actions) if you'd
rather not keep a scheduler resident.

---

## 4. Docker image

`backend/Dockerfile` — slim Python 3.11, non-root user, `EXPOSE 8000`, respects `$PORT`,
`/data` is a mountable volume. Build context is `backend/`:

```bash
cd backend
docker build -t singularity-backend .
docker run -p 8000:8000 \
  -e SINGULARITY_ENABLE_SCHEDULER=true \
  -e ANTHROPIC_API_KEY=sk-... \
  -e SINGULARITY_ADMIN_TOKEN=... \
  -v singularity_data:/data \
  singularity-backend
```

---

## 5. Deploy to Fly.io

`fly.toml` is at the repo root; the build context is `backend/`. Placeholder app name is
`singularity-narrator` — rename it first.

```bash
# once:
fly launch --no-deploy --copy-config --name <your-app>       # or edit app = "..." in fly.toml
fly volumes create singularity_data --size 1 --region iad
fly secrets set ANTHROPIC_API_KEY=sk-... SINGULARITY_ADMIN_TOKEN=<token>

# deploy (build context = ./backend, config = root fly.toml):
fly deploy ./backend --config fly.toml
```

The config runs one always-on `shared-cpu-1x` / 512 MB machine with
`SINGULARITY_ENABLE_SCHEDULER=true`, the volume mounted at `/data`, HTTP on `8000`, and a
health check on `/api/status`. `auto_stop_machines = false` + `min_machines_running = 1`
keep it alive so the daily wake actually fires.

---

## 6. Deploy to Railway

`railway.json` is at the repo root (builder = Dockerfile).

1. Create a service from this repo.
2. Set the service **Root Directory** to `backend` so the build context (and
   `.dockerignore`) is `backend/`; `dockerfilePath: "Dockerfile"` then resolves to
   `backend/Dockerfile`.
3. Attach a **volume mounted at `/data`** (matches `SINGULARITY_DATA`).
4. Set variables: `ANTHROPIC_API_KEY`, `SINGULARITY_ADMIN_TOKEN`,
   `SINGULARITY_ENABLE_SCHEDULER=true`, `SINGULARITY_WAKE_HOUR=9`, `SINGULARITY_TZ=UTC`,
   `SINGULARITY_DATA=/data`, `SINGULARITY_DB=/data/singularity.db`.
5. Deploy. Health check is `/api/status`.

---

## 7. Kill-switch (the off-ramp)

Autonomy has an off switch. It's checked at the top of every ritual, so flipping it on
halts publishing without touching the deploy.

```bash
# halt
curl -X POST "$BASE/api/admin/kill?on=true"  -H "x-admin-token: $SINGULARITY_ADMIN_TOKEN"
# resume
curl -X POST "$BASE/api/admin/kill?on=false" -H "x-admin-token: $SINGULARITY_ADMIN_TOKEN"
# check
curl "$BASE/api/status"        # -> {"kill_switch": true/false, ...}
```

While halted, the scheduler still fires daily but each wake returns `{"status": "halted"}`
and publishes nothing.
