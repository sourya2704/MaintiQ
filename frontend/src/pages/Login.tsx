import { lazy, Suspense, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BearingIcon, MemoryIcon, MicIcon, ShieldIcon } from "../components/icons/MachineIcons";
import { Logo } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Input } from "../components/ui/kit";
import { useAuth } from "../lib/auth";

const GearTrain = lazy(() => import("../components/three/GearTrain"));

const FEATURES = [
  { icon: MicIcon, title: "Speak the fault", body: "Gnani Prisma turns a voice note into text, in English or Hindi." },
  { icon: BearingIcon, title: "Structured draft", body: "Gnani Evon lists symptoms, actions and missing information." },
  { icon: MemoryIcon, title: "Failure memory", body: "Past incidents on the same machine appear with the fix that worked." },
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
    <div className="grid min-h-screen lg:grid-cols-[minmax(420px,520px)_1fr]">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <Logo />
        <h1 className="mt-10 font-display text-4xl font-bold uppercase leading-none tracking-wide">
          {mode === "login" ? "Sign in" : "Set up your plant"}
        </h1>
        <p className="mt-2 text-ink-dim">Voice-first maintenance records for industrial teams.</p>

        <div className="mt-8 grid grid-cols-2 rounded-lg border border-line bg-sunk p-1" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md py-2 text-sm font-semibold transition ${mode === m ? "bg-card text-ink shadow-sm" : "text-ink-mute hover:text-ink"}`}
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
          <Button3D type="submit" variant="primary" size="lg" block loading={busy}>
            {mode === "login" ? "Sign in" : "Create organisation"}
          </Button3D>
        </form>
        {mode === "login" && (
          <p className="mt-5 text-sm text-ink-mute">
            Demo plant (fictional): <span className="font-mono text-ink-dim">tech@demo-mantiq.example.com</span>
          </p>
        )}
      </div>

      <div className="relative hidden overflow-hidden bg-espresso lg:block">
        <Suspense fallback={null}>
          <GearTrain className="absolute inset-0" />
        </Suspense>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-espresso via-espresso/90 to-transparent p-10 pt-24">
          <p className="max-w-lg font-display text-4xl font-bold uppercase leading-tight tracking-wide text-cream">
            Every fault remembered. <span className="text-[#d9b98a]">Every fix reused.</span>
          </p>
          <div className="mt-6 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <Icon size={20} className="mt-0.5 shrink-0 text-[#d9b98a]" />
                <div>
                  <div className="text-sm font-semibold text-cream">{title}</div>
                  <div className="text-sm text-cream/60">{body}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-cream/40">Powered by Gnani Prisma, Evon and Timbre · decision support only</p>
        </div>
      </div>
    </div>
  );
}
