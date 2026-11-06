import { useState, type FormEvent } from "react";
import { Logo } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Input } from "../components/ui/kit";
import { ApiError, api, tokenStore } from "../lib/api";
import { useAuth } from "../lib/auth";
import { tr } from "../lib/i18n";
import type { User } from "../lib/types";

// Shown before a language is chosen, so every line carries both languages.
const both = (en: string) => `${en} / ${tr("hi", en)}`;

/** First sign-in with the one-time password from the admin: the worker picks their own. */
export default function SetPassword() {
  const { user, updateUser, logout } = useAuth();
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.next !== f.again) {
      setError(new ApiError(422, "mismatch", both("The two new passwords do not match")));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ access_token: string; user: User }>("/api/auth/change-password", {
        current_password: f.current,
        new_password: f.next,
      });
      tokenStore.set(res.access_token);
      updateUser(res.user);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-8 font-display text-3xl font-bold">{both("Set your password")}</h1>
        <p className="mt-2 text-sm text-ink-dim">
          {user?.name}, {both("choose a password only you know. You will use it from now on.")}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label={both("One-time password")}>
            <Input required type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          </Field>
          <Field label={both("New password")} hint={both("At least 8 characters")}>
            <Input required type="password" minLength={8} autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
          </Field>
          <Field label={both("New password again")}>
            <Input required type="password" minLength={8} autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />
          </Field>
          {Boolean(error) && <ErrorBox error={error} />}
          <Button3D type="submit" variant="primary" size="lg" block loading={busy}>
            {both("Save password")}
          </Button3D>
        </form>
        <button onClick={logout} className="mt-4 text-sm text-ink-mute underline-offset-2 hover:underline">
          {both("Sign out")}
        </button>
      </div>
    </div>
  );
}
