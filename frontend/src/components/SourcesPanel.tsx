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
      className="border-t border-line pt-6"
    >
      <h2 className="text-sm font-medium text-ink">Provenance</h2>
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
        <ul className="mt-4 divide-y divide-line">
          {sources.map((s) => (
            <li key={s.id} className="flex items-baseline gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-24 shrink-0 text-xs text-faint">{s.kind}</span>
              <code className="truncate text-xs text-muted">{s.ref_id}</code>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
