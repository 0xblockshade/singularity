import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center sm:px-6">
      <span className="label text-alert">404 · off the map</span>
      <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink">
        No signal here
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        This path leads nowhere the mind has been. Return to the last thing it said.
      </p>
      <Link
        to="/"
        className="focusable mt-6 rounded-md border border-line px-5 py-2 font-mono text-xs uppercase tracking-[0.14em] text-ink transition-colors hover:border-signal hover:text-signal"
      >
        today&rsquo;s dispatch →
      </Link>
    </div>
  );
}
