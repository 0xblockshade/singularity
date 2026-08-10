import { Link, useParams } from "react-router-dom";
import { getDispatch } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { Markdown } from "@/components/Markdown";
import { SourcesPanel } from "@/components/SourcesPanel";
import { SampleBadge } from "@/components/SampleBadge";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/utils";

const PAGE_GUTTERS = "mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16";

export default function DispatchDetail() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const { data, error, loading } = useAsyncData(
    () => getDispatch(numericId),
    [numericId],
  );

  return (
    <article className={PAGE_GUTTERS}>
      <Link
        to="/dispatches"
        className="focusable inline-block rounded-sm text-sm font-medium text-muted transition-colors hover:text-ink"
      >
        ← Archive
      </Link>

      {loading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-52" />
          <div className="hairline my-6" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-8">
          <StateBlock
            tone="alert"
            label="Signal lost"
            title="Could not load this dispatch"
            body="It may be mid-cycle. Try again shortly."
          />
        </div>
      ) : !data?.data ? (
        <div className="mt-8">
          <StateBlock
            label="Not found"
            title="No such dispatch"
            body={`There is no dispatch #${id} in the record.`}
          >
            <Link
              to="/dispatches"
              className="focusable rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              Back to the archive
            </Link>
          </StateBlock>
        </div>
      ) : (
        <>
          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs leading-5 text-muted">
                Dispatch #{data.data.id} · run #{data.data.run_id}
              </span>
              {data.sample ? <SampleBadge /> : null}
            </div>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-ink sm:text-5xl">
              {data.data.title}
            </h1>
            <p className="mt-4 text-xs leading-5 text-muted">
              <span className="text-ink">{data.data.narrator_name}</span>
              {" · "}
              {formatDateTime(data.data.published_at)}
              {" · "}
              {data.data.model}
            </p>
          </header>

          <div className="hairline my-8" />

          <Markdown>{data.data.body}</Markdown>

          <div className="mt-12">
            <SourcesPanel sources={data.data.sources} />
          </div>
        </>
      )}
    </article>
  );
}
