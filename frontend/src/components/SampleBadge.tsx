/**
 * Quiet note when bundled fixtures stand in for a real API response.
 */
export function SampleBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-xs text-faint ${className}`}
      title="No real dispatches yet — showing bundled sample data so the design is visible."
    >
      Sample data
    </span>
  );
}
