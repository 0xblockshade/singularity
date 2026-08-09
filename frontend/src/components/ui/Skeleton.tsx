import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse-soft rounded-md bg-panel/80", className)}
      aria-hidden="true"
    />
  );
}
