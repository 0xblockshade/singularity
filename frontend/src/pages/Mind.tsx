import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getBeliefs, getMemory, getSandboxStatus } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useStatus } from "@/context/StatusContext";
import { BeliefGraph } from "@/components/mind/BeliefGraph";
import { MemoryTimeline } from "@/components/mind/MemoryTimeline";
import { SampleBadge } from "@/components/SampleBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { confidencePct } from "@/lib/utils";
import type { Belief } from "@/lib/types";

export default function Mind() {
  const beliefsQ = useAsyncData(() => getBeliefs(), []);
  const memoryQ = useAsyncData(() => getMemory(), []);
  const sandboxQ = useAsyncData(() => getSandboxStatus(), []);
  const { status } = useStatus();

  const sandbox = sandboxQ.data?.data ?? null;

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
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
      <PageHeader
        eyebrow="The mind"
        title="Beliefs, and how they changed"
        description={
          <>
            Two views of one mind: the live constellation of what it currently believes, and the
            append-only record of every worldview it has held. Watch it revise itself, and check
            that it never pretends it didn&rsquo;t.
          </>
        }
        aside={sample ? <SampleBadge /> : null}
      />

      {/* Belief graph + detail */}
      <section className="mt-10" aria-label="Belief graph">
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          {beliefsQ.loading ? (
            <Skeleton className="h-[420px] w-full rounded-2xl sm:h-[520px]" />
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
      <section className="mt-20" aria-label="Memory timeline">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">Memory</span>
          <h2 className="font-sans text-xl font-semibold tracking-tight text-ink">
            The evolving worldview
          </h2>
        </div>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Every version the mind has committed, newest first. Each entry keeps the change that
          produced it: a diff of a mind against its former self.
        </p>

        <div className="mt-6">
          {memoryQ.loading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
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

      {/* Sandbox teaser */}
      {sandbox ? (
        <section className="mt-20" aria-label="The sandbox">
          <Link
            to="/sandbox"
            className="focusable panel-shell group flex flex-wrap items-center justify-between gap-4 p-5 transition-colors hover:border-ink/20 sm:p-6"
          >
            <div className="max-w-prose">
              <span className="eyebrow">The sandbox</span>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Beyond changing its mind, it changes <span className="text-ink">how it thinks</span>
                , rewriting its own analytical methods from the research it reads.{" "}
                <span className="font-semibold tabular-nums text-ink">
                  {sandbox.faculty_count} facult{sandbox.faculty_count === 1 ? "y" : "ies"}
                </span>{" "}
                revised across{" "}
                <span className="font-semibold tabular-nums text-ink">{sandbox.cycles} cycles</span>.
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-muted transition-colors group-hover:text-ink">
              See the loop →
            </span>
          </Link>
        </section>
      ) : null}
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
      <aside className="panel-shell p-5 sm:p-6">
        <span className="eyebrow">Inspect</span>
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
                  <span className="shrink-0 text-[0.6875rem] tabular-nums text-muted">
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
    <aside className="panel-shell p-5 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">Belief</span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="focusable rounded-sm text-xs text-faint hover:text-ink"
          aria-label="Clear selection"
        >
          clear ✕
        </button>
      </div>
      <h3 className="mt-2 font-sans text-lg font-semibold text-ink">{belief.concept}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{belief.stance}</p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[0.6875rem] text-muted">
          <span>confidence</span>
          <span className="tabular-nums text-ink">{confidencePct(belief.confidence)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-ink transition-all"
            style={{ width: confidencePct(belief.confidence) }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line/70 pt-4 text-[0.6875rem]">
        <div>
          <dt className="text-faint">first seen</dt>
          <dd className="mt-0.5 tabular-nums text-ink">run #{belief.first_seen_run}</dd>
        </div>
        <div>
          <dt className="text-faint">last changed</dt>
          <dd className="mt-0.5 tabular-nums text-ink">run #{belief.last_changed_run}</dd>
        </div>
      </dl>

      {changed ? (
        <p className="mt-4 text-xs text-muted">Revised this run</p>
      ) : null}
    </aside>
  );
}
