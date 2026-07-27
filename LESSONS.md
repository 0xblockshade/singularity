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
