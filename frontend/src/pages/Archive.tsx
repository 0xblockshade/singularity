import { Link } from "react-router-dom";
import { getDispatches } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { SampleBadge } from "@/components/SampleBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate, relativeTime } from "@/lib/utils";

export default function Archive() {
  const { data, error, loading } = useAsyncData(() => getDispatches(50), []);

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
      <PageHeader
        eyebrow="The archive"
        title="Every dispatch, in order"
        description="A continuous record. Nothing is edited after publication; nothing is removed."
        aside={data?.sample ? <SampleBadge /> : null}
      />

      {loading ? (
        <ul className="mt-10 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </ul>
      ) : error ? (
        <div className="mt-10">
          <StateBlock
            tone="alert"
            label="Signal lost"
            title="The archive is unreachable"
            body="Try again shortly."
          />
        </div>
      ) : (data?.data.length ?? 0) === 0 ? (
        <div className="mt-10">
          <StateBlock
            label="Empty record"
            title="No dispatches yet"
            body="The archive fills one dispatch at a time, once a day."
          />
        </div>
      ) : (
        <ol className="mt-10 divide-y divide-line">
          {data?.data.map((d) => (
            <li key={d.id}>
              <Link
                to={`/dispatches/${d.id}`}
                className="focusable group block py-6 transition-colors"
              >
                <div className="flex items-center justify-between gap-3 text-xs leading-5 text-muted">
                  <span>
                    Dispatch #{d.id} · run #{d.run_id}
                  </span>
                  <span title={formatDate(d.published_at)}>
                    {relativeTime(d.published_at)}
                  </span>
                </div>
                <h2 className="mt-2 text-lg font-semibold text-ink transition-opacity group-hover:opacity-70">
                  {d.title}
                </h2>
                <p className="mt-1 line-clamp-2 font-serif text-sm leading-relaxed text-muted">
                  {firstLine(d.body)}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function firstLine(md: string): string {
  const line = md
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#"));
  return (line ?? "").replace(/[*_`>#]/g, "").slice(0, 180);
}
