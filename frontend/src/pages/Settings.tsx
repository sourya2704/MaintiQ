import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { BearingIcon, GearIcon, GlobeIcon, SearchBoltIcon, ShieldIcon, SpeakerIcon, TrashIcon, WaveIcon } from "../components/icons/MachineIcons";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Input, Panel, Pill, Skeleton, errorText, useToast } from "../components/ui/kit";
import { Card } from "../components/ui/Card";
import { MoonIcon, ThemeChooser } from "../components/ui/ThemeToggle";
import { api, tokenStore } from "../lib/api";
import { useAuth } from "../lib/auth";
import { t, useLanguage, type Lang } from "../lib/i18n";
import { fileSize, timeAgo } from "../lib/format";
import type { IntegrationStatus } from "../lib/types";

const PROVIDER_ICON: Record<string, typeof WaveIcon> = { prisma: WaveIcon, evon: BearingIcon, gemini: SearchBoltIcon, timbre: SpeakerIcon };

function Integrations() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<IntegrationStatus>("/api/settings/integrations") });
  const check = useMutation({
    mutationFn: () => api.get<{ reachable: boolean | null; message?: string; latency_ms?: number; models?: string[] }>("/api/settings/integrations/evon/check"),
    onSuccess: (r) =>
      toast(r.reachable ? "ok" : r.reachable === null ? "info" : "alert", r.reachable ? t("Evon reachable ({ms} ms)", { ms: r.latency_ms ?? 0 }) : r.message ?? "Evon unreachable"),
    onError: (e) => toast("alert", errorText(e)),
  });
  const retention = useMutation({
    mutationFn: () => api.post<{ deleted: number; retained: number }>("/api/admin/retention/run"),
    onSuccess: (r) => toast("ok", t("Retention applied: {deleted} deleted, {retained} retained", { deleted: r.deleted, retained: r.retained })),
    onError: (e) => toast("alert", errorText(e)),
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ErrorBox error={error} />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {data.providers.map((p, i) => {
          const Icon = PROVIDER_ICON[p.provider] ?? GearIcon;
          const live = p.mode === "live";
          return (
            <Card key={p.provider} delay={i * 0.04}>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="group flex items-center gap-2">
                    <Icon size={22} className="text-brass" />
                    <span className="font-display text-sm font-bold">{p.provider}</span>
                  </div>
                  <Pill tone={live ? "ok" : p.mode === "disabled" ? "mute" : "warn"} dot>{p.mode}</Pill>
                </div>
                <div className="text-xs text-ink-dim">{t(p.purpose)}</div>
                <div className="font-mono text-[11px] text-ink-mute">{p.model}</div>
                <div className={`text-xs ${live ? "text-ok" : "text-warn"}`}>{t(p.label)}</div>
                <div className="border-t border-line pt-3 text-[11px] text-ink-mute">
                  {p.last_call ? (
                    <>
                      {t("Last call {when}", { when: timeAgo(p.last_call.at) })} · {t(p.last_call.status)} ({t(p.last_call.mode)})
                      {p.last_call.latency_ms != null && ` · ${p.last_call.latency_ms} ms`}
                    </>
                  ) : (
                    t("No calls yet")
                  )}
                  {p.last_failure && <div className="text-alert">{t("Last failure {when}", { when: timeAgo(p.last_failure.at) })} · {p.last_failure.error_code}</div>}
                  {p.mode === "live" && !p.credentials_configured && <div className="text-alert">{t("API key missing on the server")}</div>}
                </div>
                {p.provider === "evon" && can("admin") && (
                  <Button3D size="sm" variant="neutral" loading={check.isPending} onClick={() => check.mutate()}>
                    Test connection
                  </Button3D>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      <Panel title="Audio & privacy" icon={<ShieldIcon size={18} />}>
        <div className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <div className="text-[11px] text-ink-mute">{t("Max recording")}</div>
            <div className="font-mono">{data.audio.max_seconds}s · {fileSize(data.audio.max_bytes)}</div>
          </div>
          <div>
            <div className="text-[11px] text-ink-mute">{t("Audio retention")}</div>
            <div className="font-mono">{t("{n} days", { n: data.audio.retention_days })}</div>
          </div>
          <div>
            <div className="text-[11px] text-ink-mute">{t("Formats")}</div>
            <div className="font-mono text-xs">{data.audio.accepted_formats.join(" · ")}</div>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-mute">{t(data.privacy_notice)} {t("Recordings are deleted automatically after the retention period; transcripts and incidents are kept.")}</p>
        {can("admin") && (
          <div className="mt-4">
            <Button3D size="sm" variant="neutral" icon={<TrashIcon size={14} />} loading={retention.isPending} onClick={() => retention.mutate()}>
              Apply retention now
            </Button3D>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Password() {
  const toast = useToast();
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const change = useMutation({
    mutationFn: () => api.post<{ access_token: string }>("/api/auth/change-password", f),
    onSuccess: (res) => {
      // The server ends every other session; keep this one with the fresh token.
      tokenStore.set(res.access_token);
      toast("ok", "Password updated");
      setF({ current_password: "", new_password: "" });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    change.mutate();
  };
  return (
    <Panel title="Change password" icon={<ShieldIcon size={18} />}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Current password">
          <Input required type="password" autoComplete="current-password" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
        </Field>
        <Field label="New password">
          <Input required type="password" minLength={8} autoComplete="new-password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} />
        </Field>
        <Button3D type="submit" variant="neutral" loading={change.isPending}>Update</Button3D>
        {change.error && <div className="sm:col-span-3"><ErrorBox error={change.error} /></div>}
      </form>
    </Panel>
  );
}

function Language() {
  const { lang, setLang } = useLanguage();
  const toast = useToast();
  const options: { value: Lang; label: string }[] = [
    { value: "en", label: "English" },
    { value: "hi", label: "हिन्दी" },
  ];
  return (
    <Panel title="Language" icon={<GlobeIcon size={18} />}>
      <p className="mb-4 text-sm text-ink-dim">{t("Mantiq shows every screen in this language. It is saved on your account, so it stays the same after you sign out and back in.")}</p>
      <div className="inline-grid grid-cols-2 rounded-lg border border-line bg-sunk p-1" role="radiogroup" aria-label={t("Language")}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={lang === o.value}
            lang={o.value}
            onClick={() => lang !== o.value && setLang(o.value).catch((e) => toast("alert", errorText(e)))}
            className={`rounded-md px-6 py-2 text-sm font-semibold transition ${lang === o.value ? "bg-card text-ink shadow-sm" : "text-ink-mute hover:text-ink"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

export default function Settings() {
  const { can } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader kicker="Configuration" title="Settings" icon={<GearIcon size={28} />} />
      <Language />
      <Panel title="Appearance" icon={<MoonIcon size={18} />}>
        <p className="mb-4 text-sm text-ink-dim">{t("Dark mode is easier on the eyes on night shift. This choice is kept on this device.")}</p>
        <ThemeChooser />
      </Panel>
      {can("admin", "supervisor") && <Integrations />}
      <Password />
    </div>
  );
}
