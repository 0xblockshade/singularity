import type { Source } from "@/lib/types";

/** "Shaped by N transmissions, M signals" + the sourced evidence list. */
export function SourcesPanel({ sources }: { sources: Source[] }) {
  const transmissions = sources.filter((s) => s.kind === "transmission");
  const signals = sources.filter((s) => s.kind === "signal");

  const summary = [
    transmissions.length
      ? `${transmissions.length} transmission${transmissions.length === 1 ? "" : "s"}`
      : null,
    signals.length ? `${signals.length} signal${signals.length === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <section
      aria-label="Evidence that shaped this dispatch"
      className="rounded-xl border border-line bg-surface/50 p-5"
    >
      <span className="label">Provenance</span>
      <p className="mt-2 text-sm text-muted">
        {summary ? (
          <>
            Shaped by <span className="text-ink">{summary}</span>. Every dispatch is chained to
            the evidence it was built from.
          </>
        ) : (
          "No sources recorded for this dispatch."
        )}
      </p>

      {sources.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-panel/40 px-3 py-2"
            >
              <span
                className={
                  "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.14em] " +
                  (s.kind === "signal"
                    ? "bg-signal/10 text-signal"
                    : "bg-ember/10 text-ember")
                }
              >
                {s.kind}
              </span>
              <code className="truncate font-mono text-xs text-muted">{s.ref_id}</code>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
