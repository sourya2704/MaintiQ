import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** "system" follows the phone or computer setting; the choice is kept on this device. */
export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

const KEY = "mantiq-theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

const resolve = (c: ThemeChoice): Theme => (c === "system" ? (media().matches ? "dark" : "light") : c);

function apply(theme: Theme, fade: boolean) {
  const root = document.documentElement;
  if (fade) {
    root.classList.add("theme-fade");
    window.setTimeout(() => root.classList.remove("theme-fade"), 320);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#090c10" : "#1c232b");
}

interface Ctx {
  choice: ThemeChoice;
  theme: Theme;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
}

const ThemeContext = createContext<Ctx>({ choice: "system", theme: "light", setChoice: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readChoice);
  const [theme, setTheme] = useState<Theme>(() => resolve(readChoice()));

  useEffect(() => {
    apply(theme, false);
  }, []); // once: the pre-paint script normally did this already

  useEffect(() => {
    if (choice !== "system") return;
    const m = media();
    const on = () => {
      const t: Theme = m.matches ? "dark" : "light";
      setTheme(t);
      apply(t, true);
    };
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [choice]);

  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      if (c === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
    const t = resolve(c);
    setChoiceState(c);
    setTheme(t);
    apply(t, true);
  }, []);

  const toggle = useCallback(() => setChoice(theme === "dark" ? "light" : "dark"), [theme, setChoice]);

  return <ThemeContext.Provider value={{ choice, theme, setChoice, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
