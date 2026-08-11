# ADR 0001 — Stack and autonomy model

- **Status:** accepted
- **Date:** 2026-07-27

## Context

`infinitum` is an autonomous AI narrator that publishes a daily dispatch with no human in the loop, ingests
an unfiltered public inbox, scans multiple social/research sources, and exposes a public evolving memory. It
must run unattended, keep an immutable archive, and be hardened against abuse of the open inbox.

## Decision

- **Backend:** Python + FastAPI + SQLite (WAL). Single-file DB is enough for a single-narrator, append-only
  workload; avoids Postgres/ops overhead. WAL for concurrent read while the ritual writes.
- **Agent:** Claude API. Opus-class model narrates + evolves memory; cheaper models triage scanning. Model IDs
  confirmed against the `claude-api` skill at build time, never hardcoded from memory.
- **Frontend:** React + Vite + Tailwind + shadcn/ui (workspace default stack), read-only except the inbox.
- **Scheduler:** a daily wake via APScheduler in-process (fallback: system cron / platform scheduler), so
  autonomy does not depend on any interactive session.
- **Autonomy:** fully autonomous auto-publish from launch. Voice is never edited. Safety is enforced *around*
  the voice — injection-resistant prompting, an illegal-content output tripwire, a kill-switch, inbox rate limits.
- **Immutability:** dispatches and memory versions are never mutated; the archive is the artwork.

## Consequences

- Simple to run and cheap to host; SQLite may need revisiting only if multi-writer or heavy analytics appear.
- Social-pulse sources (X/Reddit) are ToS-gray and must stay behind swappable adapters.
- The raw inbox concentrates risk on the agent's own robustness; injection-resistance is a first-class concern,
  not an afterthought.
