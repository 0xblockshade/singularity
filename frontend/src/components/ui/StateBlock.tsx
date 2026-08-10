import type { ReactNode } from "react";

/** Shared empty/error scaffold — a quiet instrument readout, not an alarm. */
export function StateBlock({
  label,
  title,
  body,
  tone = "neutral",
  children,
}: {
  label: string;
  title: string;
  body?: string;
  tone?: "neutral" | "alert";
  children?: ReactNode;
}) {
  return (
    <div
      className="panel-shell flex flex-col items-center px-6 py-16 text-center"
      role={tone === "alert" ? "alert" : "status"}
    >
      <span className={tone === "alert" ? "eyebrow text-alert" : "eyebrow"}>{label}</span>
      <h2 className="mt-3 font-sans text-lg font-semibold text-ink">{title}</h2>
      {body ? <p className="mt-2 max-w-sm text-sm text-muted">{body}</p> : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
