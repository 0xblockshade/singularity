import { useMemo, useState } from "react";
import { getBeliefs, getMemory } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useStatus } from "@/context/StatusContext";
import { BeliefGraph } from "@/components/mind/BeliefGraph";
import { MemoryTimeline } from "@/components/mind/MemoryTimeline";
import { SampleBadge } from "@/components/SampleBadge";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { confidencePct } from "@/lib/utils";
import type { Belief } from "@/lib/types";

export default function Mind() {
  const beliefsQ = useAsyncData(() => getBeliefs(), []);
  const memoryQ = useAsyncData(() => getMemory(), []);
  const { status } = useStatus();

  const beliefs = useMemo(() => beliefsQ.data?.data ?? [], [beliefsQ.data]);
  const versions = memoryQ.data?.data ?? [];
  const sample = Boolean(beliefsQ.data?.sample || memoryQ.data?.sample);

  const latestRun = useMemo(() => {
    if (status?.latest_run) return status.latest_run.id;
    return beliefs.reduce((m, b) => Math.max(m, b.last_changed_run), 0);
  }, [status, beliefs]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const narratorName = status?.narrator_name ?? "the mind";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="label text-signal">The mind</span>
          <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Beliefs, and how they changed
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            Two views of one mind: the live constellation of what it currently believes, and the
            append-only record of every worldview it has held. Watch it revise itself — and check
            that it never pretends it didn&rsquo;t.
          </p>
        </div>
        {sample ? <SampleBadge /> : null}
      </header>

      {/* Belief graph + detail */}
      <section className="mt-8" aria-label="Belief graph">
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          {beliefsQ.loading ? (
            <Skeleton className="h-[420px] w-full rounded-xl sm:h-[520px]" />
          ) : beliefsQ.error ? (
            <StateBlock
              tone="alert"
              label="Signal lost"
              title="The belief graph is unreachable"
              body="Try again shortly."
            />
          ) : beliefs.length === 0 ? (
            <StateBlock
              label="No structure yet"
              title="The mind holds no beliefs"
              body="Beliefs form as the agent processes signals. None have crystallised yet."
            />
          ) : (
            <BeliefGraph
              beliefs={beliefs}
              latestRun={latestRun}
              selectedId={selectedId}
              onSelect={setSelectedId}
              narratorName={narratorName}
            />
          )}

          <BeliefDetail
            belief={beliefs.find((b) => b.id === selectedId) ?? null}
            beliefs={beliefs}
            latestRun={latestRun}
            onSelect={setSelectedId}
          />
        </div>
      </section>

      {/* Memory timeline */}
      <section className="mt-16" aria-label="Memory timeline">
        <div className="flex items-baseline gap-3">
          <span className="label text-ember">Memory</span>
          <h2 className="font-sans text-xl font-semibold tracking-tight text-ink">
            The evolving worldview
          </h2>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Every version the mind has committed, newest first. Each entry keeps the change that
          produced it — a diff of a mind against its former self.
        </p>

        <div className="mt-6">
          {memoryQ.loading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : memoryQ.error ? (
            <StateBlock
              tone="alert"
              label="Signal lost"
              title="Memory is unreachable"
              body="Try again shortly."
            />
          ) : versions.length === 0 ? (
            <StateBlock
              label="Blank slate"
              title="No memory versions yet"
              body="The mind has not committed a worldview. Version 1 is written on its first run."
            />
          ) : (
            <MemoryTimeline versions={versions} />
          )}
        </div>
      </section>
    </div>
  );
}

function BeliefDetail({
  belief,
  beliefs,
  latestRun,
  onSelect,
}: {
  belief: Belief | null;
  beliefs: Belief[];
  latestRun: number;
  onSelect: (id: number | null) => void;
}) {
  if (!belief) {
    return (
      <aside className="rounded-xl border border-line bg-surface/40 p-5">
        <span className="label">Inspect</span>
        <p className="mt-2 text-sm text-muted">
          Select a node to read its stance and confidence, or pick from the list below.
        </p>
        <ul className="mt-4 flex max-h-[22rem] flex-col gap-1 overflow-y-auto pr-1">
          {[...beliefs]
            .sort((a, b) => b.confidence - a.confidence)
            .map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onSelect(b.id)}
                  className="focusable flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-panel"
                >
                  <span className="truncate text-xs text-ink">{b.concept}</span>
                  <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-muted">
                    {confidencePct(b.confidence)}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </aside>
    );
  }

  const changed = belief.last_changed_run === latestRun;

  return (
    <aside className="rounded-xl border border-signal/40 bg-surface/60 p-5">
      <div className="flex items-start justify-between gap-2">
        <span className="label text-signal">Belief</span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="focusable rounded-sm font-mono text-[0.625rem] text-faint hover:text-ink"
          aria-label="Clear selection"
        >
          clear ✕
        </button>
      </div>
      <h3 className="mt-2 font-sans text-lg font-semibold text-ink">{belief.concept}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{belief.stance}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between font-mono text-[0.6875rem] text-muted">
          <span>confidence</span>
          <span className="tabular-nums text-ink">{confidencePct(belief.confidence)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-signal transition-all"
            style={{ width: confidencePct(belief.confidence) }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 font-mono text-[0.6875rem]">
        <div>
          <dt className="text-faint">first seen</dt>
          <dd className="mt-0.5 text-ink">run #{belief.first_seen_run}</dd>
        </div>
        <div>
          <dt className="text-faint">last changed</dt>
          <dd className="mt-0.5 text-ink">run #{belief.last_changed_run}</dd>
        </div>
      </dl>

      {changed ? (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-ember/30 bg-ember/10 px-3 py-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-ember">
          <span className="h-1.5 w-1.5 rounded-full bg-ember" aria-hidden="true" />
          revised this run
        </p>
      ) : null}
    </aside>
  );
}
