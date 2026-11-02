import { motion } from "framer-motion";
import { lazy, Suspense, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BearingIcon, MemoryIcon, MicIcon, ShieldIcon } from "../components/icons/MachineIcons";
import { Logo } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Input } from "../components/ui/kit";
import { useAuth } from "../lib/auth";

const GearTrain = lazy(() => import("../components/three/GearTrain"));

const FEATURES = [
  { icon: MicIcon, title: "Speak the fault", body: "Gnani Prisma turns a technician's voice note into text, in English or Hindi." },
  { icon: BearingIcon, title: "Structured draft", body: "Gnani Evon extracts symptoms, actions and missing info for review." },
  { icon: MemoryIcon, title: "Failure memory", body: "Past incidents on the same machine surface with the fix that worked." },
  { icon: ShieldIcon, title: "Human verified", body: "AI suggestions stay labelled until a technician confirms them." },
];

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ org: "", name: "", email: "", password: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.org, form.name, form.email, form.password);
      navigate((location.state as { from?: string })?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="blueprint pointer-events-none absolute inset-0" />
      <Suspense fallback={null}>
        <GearTrain className="absolute inset-0 opacity-90 lg:left-[38%]" intensity={1.2} />
      </Suspense>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-void via-void/85 to-transparent" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl items-center gap-10 px-5 py-10 lg:grid-cols-[440px_1fr]">
        <motion.div
          initial={{ opacity: 0, rotateY: -25, x: -40 }}
          animate={{ opacity: 1, rotateY: 0, x: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ perspective: 1000 }}
        >
          <div className="glass overflow-hidden rounded-3xl">
            <div className="hazard-stripe h-1" />
            <div className="p-7">
              <Logo />
              <h1 className="mt-8 font-display text-2xl font-extrabold uppercase leading-tight tracking-[0.08em]">
                {mode === "login" ? "Enter the control room" : "Commission your plant"}
              </h1>
              <p className="mt-2 text-sm text-ink-dim">Voice-first maintenance memory for industrial teams.</p>

              <div className="mt-6 grid grid-cols-2 rounded-xl border border-line bg-deck p-1" role="tablist">
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`rounded-lg py-2 text-xs font-bold uppercase tracking-widest transition ${
                      mode === m ? "bg-panel-2 text-ember shadow-[inset_0_-2px_0_#ff8a1f]" : "text-ink-mute hover:text-ink"
                    }`}
                  >
                    {m === "login" ? "Sign in" : "New organisation"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "register" && (
                  <>
                    <Field label="Organisation">
                      <Input required minLength={2} value={form.org} onChange={set("org")} placeholder="Acme Steel – Plant 2" />
                    </Field>
                    <Field label="Your name">
                      <Input required value={form.name} onChange={set("name")} autoComplete="name" />
                    </Field>
                  </>
                )}
                <Field label="Email">
                  <Input required type="email" value={form.email} onChange={set("email")} autoComplete="email" />
                </Field>
                <Field label="Password" hint={mode === "register" ? "At least 8 characters" : undefined}>
                  <Input
                    required
                    type="password"
                    minLength={mode === "register" ? 8 : 1}
                    value={form.password}
                    onChange={set("password")}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </Field>
                {Boolean(error) && <ErrorBox error={error} />}
                <Button3D type="submit" variant="ember" size="lg" block loading={busy}>
                  {mode === "login" ? "Sign in" : "Create organisation"}
                </Button3D>
              </form>
              {mode === "login" && (
                <p className="mt-5 text-center text-xs text-ink-mute">
                  Demo plant (fictional): <span className="font-mono text-ink-dim">tech@demo-mantiq.example.com</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>

        <div className="hidden lg:block">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 max-w-lg font-display text-4xl font-extrabold uppercase leading-[1.1] tracking-[0.06em]"
          >
            Every fault <span className="text-ember drop-shadow-[0_0_18px_#ff8a1f]">remembered.</span>
            <br />
            Every fix <span className="text-plasma drop-shadow-[0_0_18px_#22d3ee]">reused.</span>
          </motion.p>
          <div className="grid max-w-xl grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24, rotateX: -20 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ delay: 0.45 + i * 0.1 }}
                className="glass group rounded-2xl p-4"
              >
                <Icon size={22} className="text-plasma" />
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <div className="mt-1 text-xs leading-relaxed text-ink-mute">{body}</div>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.3em] text-ink-mute">
            Powered by Gnani Prisma · Evon · Timbre — decision support only
          </p>
        </div>
      </div>
    </div>
  );
}
