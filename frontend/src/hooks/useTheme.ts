import { useCallback, useEffect, useState } from "react";

type Theme = "dark" | "light";
const KEY = "infinitum-theme";

function initial(): Theme {
  if (typeof localStorage !== "undefined") {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  }
  return "dark"; // dark is the primary theme
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
