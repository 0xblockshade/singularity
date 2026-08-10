import { Link } from "react-router-dom";
import { getDispatch, getDispatches } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useStatus } from "@/context/StatusContext";
import { Markdown } from "@/components/Markdown";
import { SourcesPanel } from "@/components/SourcesPanel";
import { SampleBadge } from "@/components/SampleBadge";
import { SignalField } from "@/components/effects/SignalField";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import type { DispatchDetail } from "@/lib/types";

const PAGE_GUTTERS = "mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16";

async function loadLatest(): Promise<{ dispatch: DispatchDetail | null; sample: boolean }> {
  const list = await getDispatches(1);
  const latest = list.data[0];
  if (!latest) return { dispatch: null, sample: list.sample };
  const detail = await getDispatch(latest.id);
  return {
    dispatch: detail.data,
    sample: list.sample || detail.sample,
  };
}

export default function Today() {
  const { data, error, loading } = useAsyncData(loadLatest, []);
  const { status } = useStatus();

  if (loading) {
    return (
      <>
        <SignalField />
        <div className="relative z-10">
          <TodaySkeleton />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <SignalField />
        <div className={`relative z-10 ${PAGE_GUTTERS}`}>
          <StateBlock
            tone="alert"
            label="Signal lost"
            title="Could not reach the narrator"
            body="The dispatch feed is unreachable right now. It will return on its next cycle."
          />
        </div>
      </>
    );
  }

  const dispatch = data?.dispatch ?? null;

  if (!dispatch) {
    return (
      <>
        <SignalField />
        <div className={`relative z-10 ${PAGE_GUTTERS}`}>
          <StateBlock
            label="Awaiting first light"
            title="No dispatch yet"
            body="The mind has not published. It wakes once a day; the first dispatch will appear here when it does."
          />
        </div>
      </>
    );
  }

  const run = status?.latest_run;

  return (
    <>
      <SignalField />
      <article className={`relative z-10 ${PAGE_GUTTERS}`}>
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="eyebrow">Today&rsquo;s dispatch</span>
          {data?.sample ? <SampleBadge /> : null}
        </div>

        <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[3.25rem]">
          {dispatch.title}
        </h1>

        <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs leading-5 text-muted">
          <div className="flex items-center gap-1.5">
            <dt className="text-faint">by</dt>
            <dd className="text-ink">{dispatch.narrator_name}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Published</dt>
            <dd>{formatDate(dispatch.published_at)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="text-faint">model</dt>
            <dd>{dispatch.model}</dd>
          </div>
          {run && run.output_tokens ? (
            <div className="flex items-center gap-1.5 tabular-nums">
              <dt className="text-faint">out</dt>
              <dd>{run.output_tokens.toLocaleString()} tok</dd>
            </div>
          ) : null}
        </dl>
      </header>

      <div className="hairline my-8" />

      <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
        <Markdown>{dispatch.body}</Markdown>
      </div>

      <div className="mt-12 animate-fade-up" style={{ animationDelay: "140ms" }}>
        <SourcesPanel sources={dispatch.sources} />
      </div>

      <nav className="mt-8 flex items-center justify-between text-sm font-semibold">
        <Link
          to={`/dispatches/${dispatch.id}`}
          className="focusable rounded-sm text-muted transition-colors hover:text-ink"
        >
          Permalink →
        </Link>
        <Link
          to="/dispatches"
          className="focusable rounded-sm text-muted transition-colors hover:text-ink"
        >
          The full archive →
        </Link>
      </nav>
    </article>
    </>
  );
}

function TodaySkeleton() {
  return (
    <div className={PAGE_GUTTERS}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-12 w-full" />
      <Skeleton className="mt-2 h-12 w-2/3" />
      <Skeleton className="mt-6 h-4 w-64" />
      <div className="hairline my-8" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-3/4" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}
