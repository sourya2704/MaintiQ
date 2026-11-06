import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { HI } from "./hi";
import type { User } from "./types";

/**
 * Interface language. English text is the key: `t("Sign in")` returns the Hindi
 * entry when Hindi is active, and the English text itself when no entry exists,
 * so a missing translation never breaks the page.
 */
export type Lang = "en" | "hi";
export const LANGS: Lang[] = ["en", "hi"];
const STORAGE_KEY = "mantiq.lang";

let current: Lang = readStored() ?? "en";

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "hi" ? v : null;
  } catch {
    return null;
  }
}

function store(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable: the account setting still applies after sign-in */
  }
}

type Vars = Record<string, string | number>;

function fill(text: string, vars?: Vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`)) : text;
}

/** Translate into a given language. */
export function tr(lang: Lang, text: string, vars?: Vars): string {
  return fill(lang === "hi" ? (HI[text] ?? text) : text, vars);
}

/** Translate into the active language. */
export function t(text: string, vars?: Vars): string {
  return tr(current, text, vars);
}

/** Translate only when given a plain string (for props that may also be JSX). */
export function tNode<T>(node: T): T | string {
  return typeof node === "string" ? t(node) : node;
}

export const currentLang = () => current;
export const dateLocale = () => (current === "hi" ? "hi-IN" : "en-IN");

/** Backend-generated memory rationale ("Same machine (M-104)") in the active language. */
export function tRationale(why: string): string {
  if (current !== "hi") return why;
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^Same machine \((.+)\)$/, (m) => t("Same machine ({code})", { code: m[1] })],
    [/^Same machine type \((.+)\)$/, (m) => t("Same machine type ({type})", { type: m[1] })],
    [/^Different machine type \((.+)\); ranked lower$/, (m) => t("Different machine type ({type}); ranked lower", { type: m[1] })],
    [/^Shared symptom: (.+)$/, (m) => t("Shared symptom: {list}", { list: m[1].split(", ").map((s) => t(s)).join(", ") })],
    [/^Text overlap: (.+)$/, (m) => t("Text overlap: {list}", { list: m[1] })],
  ];
  for (const [re, fn] of rules) {
    const m = why.match(re);
    if (m) return fn(m);
  }
  return t(why);
}

interface LanguageState {
  lang: Lang;
  /** True once the signed-in user has picked a language (or nobody is signed in). */
  chosen: boolean;
  setLang: (lang: Lang) => Promise<void>;
}

const LanguageContext = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [lang, setLangState] = useState<Lang>(current);
  const account = user?.preferred_language ?? null;

  // The account setting wins after sign-in, so the choice follows the user across devices.
  useEffect(() => {
    if (account && account !== lang) setLangState(account);
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  current = lang;
  useEffect(() => {
    document.documentElement.lang = lang;
    store(lang);
  }, [lang]);

  const setLang = useCallback(
    async (next: Lang) => {
      setLangState(next);
      if (user) updateUser(await api.put<User>("/api/auth/me/language", { language: next }));
    },
    [user, updateUser],
  );

  const value = useMemo(() => ({ lang, chosen: !user || Boolean(account), setLang }), [lang, user, account, setLang]);
  // Remount on change so every t() call re-renders in the new language.
  return (
    <LanguageContext.Provider value={value}>
      <div key={lang} className="contents">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage outside LanguageProvider");
  return ctx;
}
