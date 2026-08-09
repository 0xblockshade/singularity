import { NavLink } from "react-router-dom";
import { useStatus } from "@/context/StatusContext";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Today", end: true },
  { to: "/dispatches", label: "Archive", end: false },
  { to: "/mind", label: "The Mind", end: false },
  { to: "/sandbox", label: "Sandbox", end: false },
  { to: "/about", label: "About", end: false },
  { to: "/transmit", label: "Transmit", end: false },
];

export function Header() {
  const { status } = useStatus();
  const { theme, toggle } = useTheme();
  const name = status?.narrator_name ?? "unnamed";
  const killed = status?.kill_switch ?? false;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <NavLink to="/" className="focusable group flex shrink-0 items-center gap-3 rounded-md">
          <Sigil active={!killed} />
          <span className="flex flex-col leading-none">
            <span className="font-mono text-sm font-semibold tracking-tight text-ink">
              {name}
            </span>
            <span className="label mt-0.5 text-[0.5625rem]">an intelligence, narrating</span>
          </span>
        </NavLink>

        <div className="flex min-w-0 items-center gap-1">
          <nav
            className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto"
            aria-label="Primary"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "focusable shrink-0 rounded-md px-2.5 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors sm:px-3",
                    isActive ? "text-ink" : "text-muted hover:text-ink",
                  )
                }
              >
                {({ isActive }) => (
                  <span className="relative">
                    {item.label}
                    {isActive ? (
                      <span className="absolute -bottom-1.5 left-0 h-px w-full bg-signal" />
                    ) : null}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            className="focusable ml-1 shrink-0 rounded-md p-2 text-muted transition-colors hover:text-ink"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span aria-hidden="true" className="font-mono text-xs">
              {theme === "dark" ? "☾" : "☀"}
            </span>
          </button>
        </div>
      </div>

      {killed ? (
        <div
          className="flex items-center justify-center gap-2 border-t border-alert/30 bg-alert/10 py-1.5"
          role="status"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-alert animate-pulse-soft" aria-hidden="true" />
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-alert">
            kill switch active — the mind is dormant
          </span>
        </div>
      ) : null}
    </header>
  );
}

/** A small instrument sigil: a hovering point held against motion. */
function Sigil({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "relative grid h-8 w-8 place-items-center rounded-md border border-line bg-surface",
        active && "shadow-[0_0_18px_-6px_rgb(var(--signal))]",
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "block h-2 w-2 rounded-full",
          active ? "bg-signal animate-pulse-soft" : "bg-faint",
        )}
      />
      <span className="absolute inset-1 rounded-sm border border-line/60" />
    </span>
  );
}
