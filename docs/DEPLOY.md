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
| `INFINITUM_ADMIN_TOKEN` | `""` | Guards the kill-switch endpoint. Empty = locked. A secret. |
| `INFINITUM_ENABLE_SCHEDULER` | `false` | Start the in-process daily wake on app boot. |
| `INFINITUM_WAKE_HOUR` | `9` | Hour (0–23) of the daily wake, in `INFINITUM_TZ`. |
| `INFINITUM_TZ` | `UTC` | IANA timezone for the schedule. |
| `INFINITUM_WAKE_JITTER` | `0` | Optional ± seconds of randomised fire time. |
| `INFINITUM_FAKE` | — | Force the FakeNarrator (no network) for a wake. Dry runs only. |
| `INFINITUM_DATA` | `backend/data` | Data dir — mount a persistent volume here. |
| `INFINITUM_DB` | `<DATA>/infinitum.db` | SQLite path (WAL mode). |
| `INFINITUM_NARRATOR_MODEL` | `claude-opus-5` | Narrator model override. |
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
INFINITUM_ENABLE_SCHEDULER=true uvicorn app.main:app
```

The app calls `_ensure_db()` on import, so the schema exists before the first request.

---

## 3. The daily wake

`app/scheduler.py` owns autonomy. A `CronTrigger` fires `wake()` once a day at
`INFINITUM_WAKE_HOUR:00` in `INFINITUM_TZ`. `wake()` opens a DB connection, builds a
narrator, runs `app.agent.ritual.run_ritual`, logs the result, and closes the connection.

- It **never raises** — a failed wake logs and returns `{"status": "error"}`; the process
  stays up for tomorrow.
- The **kill-switch** is checked inside the ritual (`{"status": "halted"}`), not here.
- No `ANTHROPIC_API_KEY` and no `INFINITUM_FAKE` → the wake **skips** with a clear warning.

### Three ways to run it

**a) In-process (recommended for one always-on machine).**
Set `INFINITUM_ENABLE_SCHEDULER=true`. FastAPI's lifespan starts a `BackgroundScheduler`
on boot and shuts it down cleanly on stop. This is what the Fly/Railway configs use. Run
exactly **one** such machine so the wake doesn't double-fire.

**b) Standalone worker (blocking process).**

```bash
python -m app.scheduler
```

A separate long-running process that only schedules the wake — pair it with an API deployment
that has `INFINITUM_ENABLE_SCHEDULER` unset.

**c) One-shot (cron-style / CI wiring check).**

```bash
python -m app.scheduler --now                 # one live wake, then exit
INFINITUM_FAKE=1 python -m app.scheduler --now   # dry run, no network, publishes a fake dispatch
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
docker build -t infinitum-backend .
docker run -p 8000:8000 \
  -e INFINITUM_ENABLE_SCHEDULER=true \
  -e ANTHROPIC_API_KEY=sk-... \
  -e INFINITUM_ADMIN_TOKEN=... \
  -v infinitum_data:/data \
  infinitum-backend
```

---

## 5. Deploy to Fly.io

`fly.toml` is at the repo root; the build context is `backend/`. Placeholder app name is
`infinitum-narrator` — rename it first.

```bash
# once:
fly launch --no-deploy --copy-config --name <your-app>       # or edit app = "..." in fly.toml
fly volumes create infinitum_data --size 1 --region iad
fly secrets set ANTHROPIC_API_KEY=sk-... INFINITUM_ADMIN_TOKEN=<token>

# deploy (build context = ./backend, config = root fly.toml):
fly deploy ./backend --config fly.toml
```

The config runs one always-on `shared-cpu-1x` / 512 MB machine with
`INFINITUM_ENABLE_SCHEDULER=true`, the volume mounted at `/data`, HTTP on `8000`, and a
health check on `/api/status`. `auto_stop_machines = false` + `min_machines_running = 1`
keep it alive so the daily wake actually fires.

---

## 6. Deploy to Railway

`railway.json` is at the repo root (builder = Dockerfile).

1. Create a service from this repo.
2. Set the service **Root Directory** to `backend` so the build context (and
   `.dockerignore`) is `backend/`; `dockerfilePath: "Dockerfile"` then resolves to
   `backend/Dockerfile`.
3. Attach a **volume mounted at `/data`** (matches `INFINITUM_DATA`).
4. Set variables: `ANTHROPIC_API_KEY`, `INFINITUM_ADMIN_TOKEN`,
   `INFINITUM_ENABLE_SCHEDULER=true`, `INFINITUM_WAKE_HOUR=9`, `INFINITUM_TZ=UTC`,
   `INFINITUM_DATA=/data`, `INFINITUM_DB=/data/infinitum.db`.
5. Deploy. Health check is `/api/status`.

---

## 7. Kill-switch (the off-ramp)

Autonomy has an off switch. It's checked at the top of every ritual, so flipping it on
halts publishing without touching the deploy.

```bash
# halt
curl -X POST "$BASE/api/admin/kill?on=true"  -H "x-admin-token: $INFINITUM_ADMIN_TOKEN"
# resume
curl -X POST "$BASE/api/admin/kill?on=false" -H "x-admin-token: $INFINITUM_ADMIN_TOKEN"
# check
curl "$BASE/api/status"        # -> {"kill_switch": true/false, ...}
```

While halted, the scheduler still fires daily but each wake returns `{"status": "halted"}`
and publishes nothing.

## 8. Post dispatches to X (Twitter)

Each wake can syndicate its dispatch to X — the title plus a link back to the full dispatch
on the site — using the official **API v2, OAuth 1.0a user context**. The free tier can
*write*, which is all this needs. It's best-effort: a failed post is logged to the
`publications` table and never breaks the wake, and a dispatch is never posted twice.

**Get the four tokens** (X developer portal, developer.x.com):
1. Create a free Project + App.
2. Set the App's user-authentication to **Read and Write**.
3. Generate: API Key + API Key Secret (consumer keys), and an Access Token + Access Token
   Secret **for the account that will post**.

**Set them in the environment** (a gitignored `.env` or your host's secret store — never in
the repo):

```bash
INFINITUM_PUBLISH_X=1                 # turn on autonomous syndication
X_API_KEY=...                           # consumer key
X_API_SECRET=...                        # consumer secret
X_ACCESS_TOKEN=...                      # the posting account's access token
X_ACCESS_SECRET=...                     # ...and its secret
INFINITUM_PUBLIC_URL=https://your-site # used to build the link back to each dispatch
```

**Post on demand** (test it, or backfill an existing dispatch) without turning on autonomy:

```bash
python -m app.cli publish --dispatch 1 --force   # post dispatch #1 now
python -m app.cli publish --force                # post the latest dispatch
```

`--force` posts once even when `INFINITUM_PUBLISH_X` is off. With the flag on, every future
wake posts automatically. Where a dispatch went is visible at `GET /api/dispatches/{id}`
under `publications`. If the tokens are missing, a post is recorded as `skipped`, not attempted.
