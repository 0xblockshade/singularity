/**
 * Honest marker shown whenever bundled fixtures stood in for a real API
 * response. Remove alongside the fixtures once the backend has real runs.
 */
export function SampleBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-2.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-ember ${className}`}
      title="No real dispatches yet — showing bundled sample data so the design is visible."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-ember animate-pulse-soft" aria-hidden="true" />
      Sample data
    </span>
  );
}
