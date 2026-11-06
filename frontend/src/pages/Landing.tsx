import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CameraIcon,
  ChatIcon,
  CheckIcon,
  MemoryIcon,
  MicIcon,
  SearchBoltIcon,
  ShieldIcon,
  UsersIcon,
  WrenchIcon,
} from "../components/icons/MachineIcons";
import { Logo } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Input, Textarea } from "../components/ui/kit";
import { api } from "../lib/api";
import { t, useLanguage } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { ThemeToggle } from "../components/ui/ThemeToggle";

const LandingScene = lazy(() => import("../components/three/LandingScene"));

const NAV = [
  { id: "product", label: "Product" },
  { id: "memory", label: "How it works" },
  { id: "trust", label: "Trust" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

/** Section index (fractional between sections) drives the 3D camera; scrolling also skips the arrival. */
function useSectionProgress(ids: string[], skip: { current: boolean }) {
  const progress = useRef(0);
  useEffect(() => {
    // Measured at most once per frame: scroll events can fire several times a frame, and each
    // measurement forces layout while the 3D canvas is also drawing.
    let queued = 0;
    const measure = () => {
      queued = 0;
      const mid = window.innerHeight * 0.45;
      const tops = ids.map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? 0);
      let p = 0;
      for (let i = 0; i < tops.length; i++) {
        const next = tops[i + 1] ?? tops[i] + window.innerHeight;
        if (tops[i] <= mid) p = i + Math.min(1, Math.max(0, (mid - tops[i]) / Math.max(1, next - tops[i])));
      }
      progress.current = Math.min(p, ids.length - 1);
      if (window.scrollY > 40) skip.current = true; // scrolling fast-forwards the arrival
    };
    const update = () => {
      if (!queued) queued = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(queued);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids, skip]);
  return progress;
}

function Section({ id, children, wide }: { id: string; children: ReactNode; wide?: boolean }) {
  return (
    <section id={id} className="flex min-h-[100svh] scroll-mt-16 items-end px-4 pb-10 pt-24 sm:items-center sm:px-8 sm:pb-0">
      <div className={`reveal w-full rounded-2xl border border-line bg-card/95 p-6 shadow-lg sm:p-8 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        {children}
      </div>
    </section>
  );
}

function Point({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rust/10 text-rust">{icon}</span>
      <div>
        <div className="font-semibold text-ink">{t(title)}</div>
        <div className="text-sm text-ink-dim">{children}</div>
      </div>
    </li>
  );
}

function Kicker({ children }: { children: string }) {
  return <div className="text-[13px] font-semibold text-brass">{t(children)}</div>;
}

function H2({ children }: { children: string }) {
  return <h2 className="mt-1 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">{t(children)}</h2>;
}

function ContactForm() {
  const [f, setF] = useState({ name: "", company: "", contact: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<unknown>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await api.post("/api/public/contact", f);
      setState("sent");
    } catch (err) {
      setError(err);
      setState("idle");
    }
  };
  if (state === "sent")
    return (
      <div className="flex items-start gap-3 rounded-xl bg-ok/10 p-4 text-sm text-ink">
        <CheckIcon size={18} className="mt-0.5 text-ok" />
        {t("Thank you. We will get back to you within two working days.")}
      </div>
    );
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Your name">
        <Input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
      </Field>
      <Field label="Company">
        <Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} autoComplete="organization" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Email or phone">
          <Input required minLength={5} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="What would you like to know?">
          <Textarea required minLength={5} rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={t("e.g. How many machines it suits, pricing, a trial for our plant")} />
        </Field>
      </div>
      {/* spam trap: hidden from people */}
      <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="hidden" aria-hidden name="website" />
      {Boolean(error) && (
        <div className="sm:col-span-2">
          <ErrorBox error={error} />
        </div>
      )}
      <div className="sm:col-span-2">
        <Button3D type="submit" variant="primary" loading={state === "sending"}>
          Send message
        </Button3D>
      </div>
    </form>
  );
}

export default function Landing() {
  const ids = useMemo(() => ["top", "product", "memory", "shopfloor", "trust", "about", "contact"], []);
  const intro = useRef(0);
  const skip = useRef(false);
  const progress = useSectionProgress(ids, skip);
  const scene = useMemo(() => ({ progress, intro, skip }), [progress]);
  const [arrived, setArrived] = useState(false);
  const { lang, setLang } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const { theme } = useTheme();
  const night = theme === "dark";
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="relative">
      <Suspense
        fallback={
          <div
            className={`fixed inset-0 bg-gradient-to-b ${night ? "from-[#03050c] via-[#0a1630] to-[#0b1322]" : "from-[#b9cddd] via-[#cfdbe6] to-[#e9eef2]"}`}
          />
        }
      >
        <LandingScene state={scene} night={night} onIntroDone={() => setArrived(true)} className="fixed inset-0 -z-0" />
      </Suspense>
      {/* soft dark fade at the bottom of the view keeps text cards and the footer readable */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
      {!arrived && (
        <button
          onClick={() => (skip.current = true)}
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-espresso/90 px-4 py-2 text-sm font-semibold text-cream hover:bg-espresso"
        >
          {t("Skip intro")}
        </button>
      )}

      <header className={`fixed inset-x-0 top-0 z-30 transition-colors duration-200 ${scrolled ? "border-b border-line bg-card/95" : "bg-card/75"}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <a href="#top" aria-label="Mantiq">
            <Logo />
          </a>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-dim lg:flex" aria-label={t("Main menu")}>
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} className="hover:text-ink">
                {t(n.label)}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={() => setLang(lang === "en" ? "hi" : "en")} lang={lang === "en" ? "hi" : "en"} className="rounded-md px-2 py-1 text-sm font-semibold text-ink-dim hover:bg-sunk">
              {lang === "en" ? "हिन्दी" : "English"}
            </button>
            <Link to="/login" className="hidden rounded-md px-3 py-2 text-sm font-semibold text-ink hover:bg-sunk sm:block">
              {t("Sign in")}
            </Link>
            <Link to="/register" className="rounded-lg bg-rust px-4 py-2 text-sm font-semibold text-cream shadow-sm hover:bg-rust-deep">
              {t("Get started")}
            </Link>
            <button onClick={() => setMenu((m) => !m)} className="rounded-md px-2 py-2 text-sm font-semibold text-ink lg:hidden" aria-expanded={menu} aria-label={t("Open menu")}>
              {t("Menu")}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-line bg-card px-4 py-2 lg:hidden">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`} onClick={() => setMenu(false)} className="block py-2.5 text-[15px] font-medium text-ink">
                {t(n.label)}
              </a>
            ))}
            <Link to="/login" className="block py-2.5 text-[15px] font-medium text-rust">
              {t("Sign in")}
            </Link>
          </nav>
        )}
      </header>

      <main className="relative z-10">
        <section id="top" className="flex min-h-[100svh] items-end px-4 pb-12 pt-24 sm:items-center sm:px-8">
          <div
            className={`max-w-2xl rounded-2xl border border-line bg-card/95 p-6 shadow-lg transition-[opacity,transform] duration-500 ease-out will-change-transform sm:p-10 ${
              arrived ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
            }`}
          >
            <Kicker>Maintenance records for factories</Kicker>
            <h1 className="mt-2 font-display text-4xl font-bold leading-[1.05] text-ink sm:text-6xl">
              {t("Every fault remembered.")} <span className="text-rust">{t("Every fix reused.")}</span>
            </h1>
            <p className="mt-4 text-base text-ink-dim sm:text-lg">
              {t("Mechanics report a fault by speaking, in Hindi or English. Mantiq writes it up, finds how the same fault was fixed before, and suggests what to check next.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register" className="rounded-lg bg-rust px-5 py-3 font-semibold text-cream shadow-sm hover:bg-rust-deep">
                {t("Set up your plant")}
              </Link>
              <a href="#product" className="rounded-lg border border-line-strong bg-card px-5 py-3 font-semibold text-ink hover:bg-sunk">
                {t("See how it works")}
              </a>
            </div>
            <p className="mt-6 text-xs text-ink-mute">{t("Scroll to walk through the plant.")}</p>
          </div>
        </section>

        <Section id="product">
          <Kicker>1. Report</Kicker>
          <H2>Speak the fault, at the machine</H2>
          <ul className="mt-5 space-y-4">
            <Point icon={<MicIcon size={17} />} title="Voice notes up to two minutes">
              {t("In Hindi, English or both. Gnani Prisma turns speech into text that the mechanic checks before anything is saved.")}
            </Point>
            <Point icon={<CameraIcon size={17} />} title="Photos from the phone">
              {t("The leak, the worn part, the fault code on the display. Attached to the report in one tap.")}
            </Point>
            <Point icon={<WrenchIcon size={17} />} title="A clean record, not a chat log">
              {t("Symptoms, what was already checked and what is missing are pulled out into a report the supervisor can confirm.")}
            </Point>
          </ul>
        </Section>

        <Section id="memory">
          <Kicker>2. Fix</Kicker>
          <H2>The fix your plant already knows</H2>
          <ul className="mt-5 space-y-4">
            <Point icon={<MemoryIcon size={17} />} title="Failure memory">
              {t("Finds earlier faults on the same machine, the same type of machine or with the same symptoms, and shows what fixed them.")}
            </Point>
            <Point icon={<SearchBoltIcon size={17} />} title="Suggested steps, with sources">
              {t("AI combines your verified fixes with manufacturer guidance from the web, in a safe order, and lists the pages it used.")}
            </Point>
          </ul>
        </Section>

        <Section id="shopfloor">
          <Kicker>3. Work together</Kicker>
          <H2>Made for the shop floor</H2>
          <ul className="mt-5 space-y-4">
            <Point icon={<UsersIcon size={17} />} title="Accounts for every worker">
              {t("The admin adds people and Mantiq creates their company login. Mechanics get simple phone screens; supervisors see the whole plant.")}
            </Point>
            <Point icon={<ChatIcon size={17} />} title="Fixes sent in their language">
              {t("A supervisor sends the steps to a mechanic. Written in English, read in Hindi, and the other way round.")}
            </Point>
          </ul>
        </Section>

        <Section id="trust">
          <Kicker>Trust</Kicker>
          <H2>Safe by default</H2>
          <ul className="mt-5 space-y-4">
            <Point icon={<ShieldIcon size={17} />} title="Decision support, never a diagnosis">
              {t("Every guide starts with lockout. Reported hazards are flagged for escalation. Nothing counts as fact until a person confirms it.")}
            </Point>
            <Point icon={<CheckIcon size={17} />} title="Your records stay yours">
              {t("Each plant sees only its own data. Access follows each person's role, every change is logged, and voice recordings are deleted after the retention period you set.")}
            </Point>
          </ul>
        </Section>

        <Section id="about" wide>
          <Kicker>About</Kicker>
          <H2>Why we built Mantiq</H2>
          <div className="mt-4 space-y-3 text-[15px] text-ink-dim">
            <p>{t("In most plants, what keeps machines running lives in people's heads. The same fault gets fixed again and again, by different people, with no record of what worked last time.")}</p>
            <p>{t("Mantiq makes writing it down take seconds, in the language people actually speak, and turns the plant's own history into advice for the next shift.")}</p>
            <p className="text-sm text-ink-mute">{t("Speech, reasoning and voice by Gnani AI. Fix suggestions by Google Gemini.")}</p>
          </div>
        </Section>

        <Section id="contact" wide>
          <Kicker>Contact</Kicker>
          <H2>Talk to us</H2>
          <p className="mb-5 mt-2 text-[15px] text-ink-dim">{t("Tell us about your plant and we will help you set it up. Already using Mantiq?")} <Link to="/login" className="font-semibold text-rust hover:underline">{t("Sign in")}</Link></p>
          <ContactForm />
        </Section>

        <footer className="px-4 pb-8 sm:px-8">
          <div className="flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl bg-espresso px-5 py-4 text-sm text-cream/70">
            <span>© {new Date().getFullYear()} Mantiq</span>
            <span className="flex gap-4">
              {NAV.map((n) => (
                <a key={n.id} href={`#${n.id}`} className="hover:text-cream">
                  {t(n.label)}
                </a>
              ))}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
