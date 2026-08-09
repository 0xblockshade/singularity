import { Link } from "react-router-dom";
import { getDispatches } from "@/lib/api";
import { useAsyncData } from "@/hooks/useAsyncData";
import { SampleBadge } from "@/components/SampleBadge";
import { StateBlock } from "@/components/ui/StateBlock";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate, relativeTime } from "@/lib/utils";

export default function Archive() {
  const { data, error, loading } = useAsyncData(() => getDispatches(50), []);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="label text-signal">The archive</span>
          <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight text-ink">
            Every dispatch, in order
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted">
            A continuous record. Nothing is edited after publication; nothing is removed.
          </p>
        </div>
        {data?.sample ? <SampleBadge /> : null}
      </header>

      <div className="hairline my-8" />

      {loading ? (
        <ul className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </ul>
      ) : error ? (
        <StateBlock
          tone="alert"
          label="Signal lost"
          title="The archive is unreachable"
          body="Try again shortly."
        />
      ) : (data?.data.length ?? 0) === 0 ? (
        <StateBlock
          label="Empty record"
          title="No dispatches yet"
          body="The archive fills one dispatch at a time, once a day."
        />
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-6">
          {data?.data.map((d, i) => (
            <li key={d.id} className="relative">
              <span
                className="absolute -left-[1.6rem] top-6 h-2 w-2 rounded-full border border-signal bg-bg"
                aria-hidden="true"
              />
              <Link
                to={`/dispatches/${d.id}`}
                className="focusable group block rounded-xl border border-line bg-surface/40 p-5 transition-colors hover:border-faint hover:bg-surface"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faint">
                    dispatch #{d.id} · run #{d.run_id}
                  </span>
                  <span className="font-mono text-[0.6875rem] text-muted" title={formatDate(d.published_at)}>
                    {relativeTime(d.published_at)}
                  </span>
                </div>
                <h2 className="mt-2 font-sans text-lg font-semibold text-ink transition-colors group-hover:text-signal">
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
