import { motion } from "framer-motion";
import { useState } from "react";
import { Logo } from "../components/layout/AppShell";
import { BilingualLoop, Say } from "../components/ui/Bilingual";
import { ErrorBox } from "../components/ui/kit";
import { useAuth } from "../lib/auth";
import { useLanguage, type Lang } from "../lib/i18n";

const OPTIONS: { lang: Lang; name: string; sub: string; sample: string }[] = [
  { lang: "en", name: "English", sub: "Continue in English", sample: "Report a fault · Machines · Failure memory" },
  { lang: "hi", name: "हिन्दी", sub: "हिन्दी में जारी रखें", sample: "खराबी दर्ज करें · मशीनें · खराबी का इतिहास" },
];

/** Asked once after registration (or the first sign-in); the choice is saved on the account. */
export default function ChooseLanguage() {
  const { user } = useAuth();
  const { setLang } = useLanguage();
  const [busy, setBusy] = useState<Lang | null>(null);
  const [error, setError] = useState<unknown>(null);

  const choose = async (lang: Lang) => {
    setBusy(lang);
    setError(null);
    try {
      await setLang(lang);
    } catch (e) {
      setError(e);
      setBusy(null);
    }
  };

  return (
    <BilingualLoop>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <Logo />
        <h1 className="mt-10 min-h-[1.3em] text-center font-display text-4xl font-bold uppercase leading-snug tracking-wide">
          <Say>Choose your language</Say>
        </h1>
        <p className="mt-2 min-h-[1.5em] max-w-md text-center text-ink-dim">
          <Say vars={{ name: user?.name.split(" ")[0] ?? "" }}>{"Welcome, {name}. Mantiq will show everything in the language you pick."}</Say>
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          {OPTIONS.map((o, i) => (
            <motion.button
              key={o.lang}
              type="button"
              lang={o.lang}
              disabled={busy !== null}
              onClick={() => choose(o.lang)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`surface group rounded-2xl p-6 text-left transition hover:border-rust/60 hover:shadow-md disabled:opacity-60 ${busy === o.lang ? "!border-rust" : ""}`}
            >
              <div className="font-display text-4xl font-bold text-ink group-hover:text-rust">{o.name}</div>
              <div className="mt-1 text-base font-semibold text-ink-dim">{o.sub}</div>
              <div className="mt-4 border-t border-line pt-3 text-sm text-ink-mute">{o.sample}</div>
            </motion.button>
          ))}
        </div>
        {Boolean(error) && (
          <div className="mt-6 w-full max-w-2xl">
            <ErrorBox error={error} />
          </div>
        )}
        <p className="mt-8 min-h-[1.5em] text-center text-xs text-ink-mute">
          <Say caret={false}>You can change this any time from the menu or Settings.</Say>
        </p>
      </div>
    </BilingualLoop>
  );
}
