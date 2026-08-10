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
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex items-center justify-between gap-4 pt-4 sm:h-14 sm:pt-0">
          <NavLink to="/" className="focusable group flex shrink-0 items-center gap-2.5 rounded-md">
            <span
              className={cn(
                "block h-2 w-2 rounded-[2px]",
                killed ? "bg-faint" : "bg-ink",
              )}
              aria-hidden="true"
            />
            <span className="font-sans text-sm font-medium tracking-tight text-ink">
              {name}
            </span>
          </NavLink>

          <div className="flex items-center gap-1">
            <nav
              className="hidden min-w-0 items-center gap-0.5 sm:flex"
              aria-label="Primary"
            >
              {NAV.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </nav>
            <button
              type="button"
              onClick={toggle}
              className="focusable ml-1 shrink-0 rounded-md p-2 text-muted transition-colors hover:text-ink"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <MoonIcon /> : <SunIcon />}
            </button>
          </div>
        </div>

        <nav
          className="no-scrollbar flex gap-1 overflow-x-auto pb-3 sm:hidden"
          aria-label="Primary"
        >
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
      </div>

      {killed ? (
        <div
          className="border-t border-line bg-panel py-1.5 text-center"
          role="status"
        >
          <span className="text-xs text-muted">
            Kill switch active. The mind is dormant.
          </span>
        </div>
      ) : null}
    </header>
  );
}

function NavItem({
  to,
  label,
  end,
}: {
  to: string;
  label: string;
  end: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "focusable shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
          isActive ? "text-ink" : "text-muted hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <span className="relative">
          {label}
          {isActive ? (
            <span className="absolute -bottom-1.5 left-0 h-px w-full bg-ink" />
          ) : null}
        </span>
      )}
    </NavLink>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
