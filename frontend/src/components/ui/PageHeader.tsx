import type { ReactNode } from "react";

/** Shared page masthead: eyebrow, title, optional description, optional aside. */
export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="mt-3 font-sans text-3xl font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <div className="mt-3 text-base leading-7 text-muted">{description}</div>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}
