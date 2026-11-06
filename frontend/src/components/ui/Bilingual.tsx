import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tr, type Lang } from "../../lib/i18n";

/**
 * English ⇄ Hindi typewriter loop for screens seen before a language is chosen
 * (sign-in, registration, language picker). Every <Say> on the screen erases
 * and retypes in step: English, hold, type into Hindi, hold, type back, repeat.
 */
type Phase = "en" | "toHi" | "hi" | "toEn";
const HOLD_MS = 4500;
const TYPE_MS = 1600;

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
// Whole graphemes, so Devanagari letters and their vowel signs appear together.
const graphemes = (s: string) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));

interface BilingualState {
  say: (en: string, vars?: Record<string, string | number>) => string;
  lang: Lang;
  typing: boolean;
}
const Ctx = createContext<BilingualState | null>(null);

export function BilingualLoop({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("en");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase === "en" || phase === "hi") {
      const id = window.setTimeout(() => setPhase(phase === "en" ? "toHi" : "toEn"), HOLD_MS);
      return () => clearTimeout(id);
    }
    const done = phase === "toHi" ? "hi" : "en";
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setPhase(done);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / TYPE_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setProgress(0);
        setPhase(done);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const say = useCallback(
    (en: string, vars?: Record<string, string | number>) => {
      const english = tr("en", en, vars);
      const hindi = tr("hi", en, vars);
      if (phase === "en") return english;
      if (phase === "hi") return hindi;
      const [from, to] = phase === "toHi" ? [english, hindi] : [hindi, english];
      // First half erases the old text, second half types the new one.
      if (progress < 0.5) {
        const g = graphemes(from);
        return g.slice(0, Math.round(g.length * (1 - progress * 2))).join("");
      }
      const g = graphemes(to);
      return g.slice(0, Math.round(g.length * (progress * 2 - 1))).join("");
    },
    [phase, progress],
  );

  const value = useMemo<BilingualState>(
    () => ({
      say,
      lang: phase === "hi" || (phase === "toHi" && progress >= 0.5) || (phase === "toEn" && progress < 0.5) ? "hi" : "en",
      typing: phase === "toHi" || phase === "toEn",
    }),
    [say, phase, progress],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBilingual() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBilingual outside BilingualLoop");
  return ctx;
}

/** Text that types between English and Hindi, with a caret while typing. */
export function Say({ children, vars, caret = true }: { children: string; vars?: Record<string, string | number>; caret?: boolean }) {
  const { say, lang, typing } = useBilingual();
  return (
    <span lang={lang} aria-label={`${tr("en", children, vars)} / ${tr("hi", children, vars)}`}>
      <span aria-hidden>{say(children, vars) || "​"}</span>
      {typing && caret && <span aria-hidden className="typing-caret" />}
    </span>
  );
}
