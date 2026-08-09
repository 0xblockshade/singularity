import { getImprovements, getSandboxStatus, getSelfModel } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { LoopDiagram } from "@/components/sandbox/LoopDiagram";
import { SampleBadge } from "@/components/SampleBadge";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime, relativeTime } from "@/lib/utils";
import type { Faculty, Improvement } from "@/lib/types";

export default function Sandbox() {
  const statusQ = useAsyncData(() => getSandboxStatus(), []);
  const modelQ = useAsyncData(() => getSelfModel(), []);
  const logQ = useAsyncData(() => getImprovements(100), []);

  const status = statusQ.data?.data ?? null;
  const model = modelQ.data?.data ?? null;
  const log = logQ.data?.data ?? [];

  const sample = Boolean(statusQ.data?.sample || modelQ.data?.sample || logQ.data?.sample);
  const cycles = status?.cycles ?? 0;
  const facultyCount = status?.faculty_count ?? model?.faculties.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-prose">
          <span className="label text-signal">The sandbox</span>
          <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            How it learns to think
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The mind studies AI research and rewrites the analytical methods it thinks with — then
            reads the next day&rsquo;s research through the methods it just sharpened. Knowledge
            improving the intelligence that seeks knowledge. That loop, closed and running, is the
            singularity in miniature.
          </p>
        </div>
        {sample ? <SampleBadge /> : null}
      </header>

      {/* Status strip */}
      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Self-improvements" value={logQ.loading ? null : String(log.length)} />
        <Stat label="Cycles run" value={statusQ.loading ? null : String(cycles)} />
        <Stat label="Faculties" value={statusQ.loading ? null : String(facultyCount)} />
        <Stat
          label="Last cycle"
          value={
            statusQ.loading
              ? null
              : status?.latest_cycle_at
                ? relativeTime(status.latest_cycle_at)
                : "—"
          }
        />
      </dl>

      {/* The loop — centerpiece */}
      <section className="mt-6" aria-label="The recursive self-improvement loop">
        <LoopDiagram cycles={cycles} faculties={facultyCount} />
        <p className="mt-3 max-w-prose text-xs leading-relaxed text-faint">
          <span className="text-muted">Honest framing:</span> it rewrites its analytical{" "}
          <span className="text-ink">methods</span> — how it triages signals, calibrates confidence,
          weighs a source — <span className="text-ink">not its weights</span>. The model underneath
          is fixed. What changes is how the mind chooses to use it, and every change below is
          traceable to the research that prompted it.
        </p>
      </section>

      {/* Self-model */}
      <section className="mt-16" aria-label="The self-model">
        <div className="flex items-baseline gap-3">
          <span className="label text-signal">Self-model</span>
          <h2 className="font-sans text-xl font-semibold tracking-tight text-ink">
            The faculties it thinks with
          </h2>
        </div>

        {modelQ.loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : modelQ.error ? (
          <div className="mt-6">
            <StateBlock
              tone="alert"
              label="Signal lost"
              title="The self-model is unreachable"
              body="Try again shortly."
            />
          </div>
        ) : !model || model.faculties.length === 0 ? (
          <div className="mt-6">
            <StateBlock
              label="No faculties yet"
              title="The mind has not modified itself"
              body="Faculties form and change in the sandbox. None have been rewritten yet."
            />
          </div>
        ) : (
          <>
            {model.reflection ? (
              <p className="mt-4 max-w-prose border-l-2 border-ember/50 pl-4 font-serif text-[1.0625rem] leading-relaxed text-ink/90">
                {model.reflection}
              </p>
            ) : null}
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {model.faculties.map((f) => (
                <FacultyCard key={f.name} faculty={f} />
              ))}
            </ul>
            {model.updated_at ? (
              <p className="mt-4 font-mono text-[0.6875rem] text-faint">
                self-model v{model.version} · updated {formatDateTime(model.updated_at)}
              </p>
            ) : null}
          </>
        )}
      </section>

      {/* Improvement log */}
      <section className="mt-16" aria-label="The improvement log">
        <div className="flex items-baseline gap-3">
          <span className="label text-ember">Improvement log</span>
          <h2 className="font-sans text-xl font-semibold tracking-tight text-ink">
            Every self-modification, sourced
          </h2>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Newest first. Each change traces to the research that caused it — an upgrade with no cited
          paper is an upgrade that never happened.
        </p>

        <div className="mt-6">
          {logQ.loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : logQ.error ? (
            <StateBlock
              tone="alert"
              label="Signal lost"
              title="The improvement log is unreachable"
              body="Try again shortly."
            />
          ) : log.length === 0 ? (
            <StateBlock
              label="Blank slate"
              title="No self-modifications yet"
              body="The first entry is written the first time the mind rewrites one of its own methods."
            />
          ) : (
            <ol className="relative flex flex-col gap-0">
              <span
                className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-line"
                aria-hidden="true"
              />
              {log.map((entry) => (
                <ImprovementEntry key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-line bg-surface/40 px-4 py-3">
      <dt className="label text-[0.625rem]">{label}</dt>
      <dd className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">
        {value ?? <Skeleton className="h-6 w-12" />}
      </dd>
    </div>
  );
}

function FacultyCard({ faculty }: { faculty: Faculty }) {
  const { name, current_method, times_revised, first_cycle, last_cycle } = faculty;
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface/50 p-5 transition-colors hover:border-signal/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-sans text-base font-semibold leading-snug text-ink">{name}</h3>
        <span
          className="shrink-0 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-signal"
          title={`Revised ${times_revised} time${times_revised === 1 ? "" : "s"}`}
        >
          rev ×{times_revised}
        </span>
      </div>

      {/* revision "growth" ticks */}
      <div className="mt-3 flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: Math.max(times_revised, 1) }).map((_, i) => (
          <span
            key={i}
            className={
              "h-1 flex-1 rounded-full " +
              (times_revised === 0 ? "bg-line" : "bg-signal/70")
            }
          />
        ))}
      </div>

      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{current_method}</p>

      <p className="mt-4 border-t border-line pt-3 font-mono text-[0.625rem] text-faint">
        cycle {first_cycle}
        {last_cycle !== first_cycle ? ` → ${last_cycle}` : ""}
      </p>
    </li>
  );
}

function ImprovementEntry({ entry }: { entry: Improvement }) {
  return (
    <li className="relative pb-6 pl-7">
      <span
        className="absolute left-1 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-ember bg-surface"
        aria-hidden="true"
      />
      <div className="rounded-xl border border-line bg-surface/50 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-ember">
            {entry.change}
          </span>
          <h3 className="font-sans text-base font-semibold text-ink">{entry.faculty}</h3>
          <span className="font-mono text-[0.6875rem] text-faint">
            cycle {entry.cycle} · run #{entry.run_id} · {relativeTime(entry.created_at)}
          </span>
        </div>

        <p className="mt-3 border-l-2 border-signal/40 pl-4 font-mono text-[0.8125rem] leading-relaxed text-ink/90">
          {entry.detail}
        </p>

        <p className="mt-3 text-sm leading-relaxed text-muted">{entry.rationale}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faint">
            cited research
          </span>
          {entry.cited_signals.length > 0 ? (
            entry.cited_signals.map((id) => (
              <code
                key={id}
                className="inline-flex items-center rounded-full bg-signal/10 px-2 py-0.5 font-mono text-[0.625rem] text-signal"
              >
                signal #{id}
              </code>
            ))
          ) : (
            <span className="font-mono text-[0.625rem] text-faint">none recorded</span>
          )}
        </div>
      </div>
    </li>
  );
}
