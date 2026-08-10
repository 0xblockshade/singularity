import { useState } from "react";
import type { MemoryVersion } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/**
 * Scrub the mind's evolving worldview. Versions arrive newest-first; picking one
 * reveals the change that produced it and the full worldview it left behind.
 */
export function MemoryTimeline({ versions }: { versions: MemoryVersion[] }) {
  const [active, setActive] = useState(versions[0]?.version ?? 0);
  const current = versions.find((v) => v.version === active) ?? versions[0];

  if (!current) {
    return (
      <p className="panel-shell border-dashed px-5 py-10 text-center text-sm text-muted">
        No memory versions recorded yet.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,13rem)_1fr]">
      {/* version rail */}
      <ol className="relative flex gap-3 overflow-x-auto pb-2 md:flex-col md:gap-1 md:overflow-visible md:pb-0">
        <span
          className="absolute left-[7px] top-2 hidden h-[calc(100%-1rem)] w-px bg-line/70 md:block"
          aria-hidden="true"
        />
        {versions.map((v) => {
          const on = v.version === active;
          return (
            <li key={v.version} className="relative shrink-0 md:pl-7">
              <span
                className={cn(
                  "absolute left-1 top-2.5 hidden h-2.5 w-2.5 rounded-full border md:block",
                  on ? "border-ink bg-ink" : "border-line bg-surface",
                )}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setActive(v.version)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "focusable w-full rounded-lg px-3 py-2 text-left transition-colors",
                  on
                    ? "bg-panel text-ink"
                    : "text-muted hover:bg-panel/60 hover:text-ink",
                )}
              >
                <span className="block text-xs font-semibold">
                  v{v.version}
                  {v.version === versions[0].version ? (
                    <span className="ml-1.5 text-[0.625rem] font-medium text-muted">
                      current
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[0.6875rem] tabular-nums text-faint">
                  {formatDateTime(v.created_at)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* detail */}
      <div className="panel-shell min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-ink">
            Version {current.version}
          </h3>
          <span className="text-[0.6875rem] tabular-nums text-faint">
            run #{current.run_id} · {formatDateTime(current.created_at)}
          </span>
        </div>

        <div className="mt-5">
          <span className="eyebrow">What changed</span>
          <p className="mt-2 border-l border-line pl-4 text-sm leading-relaxed text-ink">
            {current.change_summary}
          </p>
        </div>

        <div className="mt-6">
          <span className="eyebrow">Worldview at this version</span>
          <p className="mt-2 font-serif text-[1.0625rem] leading-relaxed text-ink/90">
            {current.state.worldview}
          </p>
        </div>

        <div className="mt-6 border-t border-line/70 pt-4">
          <span className="text-[0.6875rem] text-faint">
            self-designation:{" "}
            <span className="text-muted">{current.state.name || "—"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
