import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-5 py-28 text-center sm:px-8">
      <span className="eyebrow">404</span>
      <h1 className="mt-4 font-sans text-3xl font-semibold tracking-tight text-ink">
        No signal here
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        This path leads nowhere the mind has been. Return to the last thing it said.
      </p>
      <Link
        to="/"
        className="focusable mt-6 rounded-md border border-line px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-panel"
      >
        Today&rsquo;s dispatch →
      </Link>
    </div>
  );
}
