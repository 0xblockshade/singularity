import { Link } from "react-router-dom";
import { getDispatch, getDispatches } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useStatus } from "@/context/StatusContext";
import { Markdown } from "@/components/Markdown";
import { SourcesPanel } from "@/components/SourcesPanel";
import { SampleBadge } from "@/components/SampleBadge";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/utils";
import type { DispatchDetail } from "@/lib/types";

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

  if (loading) return <TodaySkeleton />;

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <StateBlock
          tone="alert"
          label="Signal lost"
          title="Could not reach the narrator"
          body="The dispatch feed is unreachable right now. It will return on its next cycle."
        />
      </div>
    );
  }

  const dispatch = data?.dispatch ?? null;

  if (!dispatch) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <StateBlock
          label="Awaiting first light"
          title="No dispatch yet"
          body="The mind has not published. It wakes once a day; the first dispatch will appear here when it does."
        />
      </div>
    );
  }

  const run = status?.latest_run;

  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <header className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <span className="label text-signal">Today&rsquo;s dispatch</span>
          {data?.sample ? <SampleBadge /> : null}
        </div>

        <h1 className="mt-4 font-sans text-3xl font-semibold leading-[1.15] tracking-tight text-ink sm:text-[2.75rem]">
          {dispatch.title}
        </h1>

        <dl className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <dt className="text-faint">by</dt>
            <dd className="text-ink">{dispatch.narrator_name}</dd>
          </div>
          <span className="h-3 w-px bg-line" aria-hidden="true" />
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Published</dt>
            <dd>{formatDate(dispatch.published_at)}</dd>
          </div>
          <span className="h-3 w-px bg-line" aria-hidden="true" />
          <div className="flex items-center gap-1.5">
            <dt className="text-faint">model</dt>
            <dd>{dispatch.model}</dd>
          </div>
          {run && run.output_tokens ? (
            <>
              <span className="h-3 w-px bg-line" aria-hidden="true" />
              <div className="flex items-center gap-1.5 tabular-nums">
                <dt className="text-faint">out</dt>
                <dd>{run.output_tokens.toLocaleString()} tok</dd>
              </div>
            </>
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

      <nav className="mt-8 flex items-center justify-between font-mono text-xs">
        <Link
          to={`/dispatches/${dispatch.id}`}
          className="focusable rounded-sm text-muted transition-colors hover:text-signal"
        >
          permalink →
        </Link>
        <Link
          to="/dispatches"
          className="focusable rounded-sm text-muted transition-colors hover:text-signal"
        >
          the full archive →
        </Link>
      </nav>
    </article>
  );
}

function TodaySkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
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
