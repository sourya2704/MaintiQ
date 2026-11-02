import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { BearingIcon, GearIcon, ShieldIcon, SpeakerIcon, TrashIcon, UsersIcon, WaveIcon } from "../components/icons/MachineIcons";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Input, Panel, Pill, Select, Skeleton, errorText, useToast } from "../components/ui/kit";
import { Card } from "../components/ui/Card";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fileSize, timeAgo } from "../lib/format";
import type { IntegrationStatus, Role, User } from "../lib/types";

const PROVIDER_ICON = { prisma: WaveIcon, evon: BearingIcon, timbre: SpeakerIcon };

function Integrations() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, isLoading, error } = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<IntegrationStatus>("/api/settings/integrations") });
  const check = useMutation({
    mutationFn: () => api.get<{ reachable: boolean | null; message?: string; latency_ms?: number; models?: string[] }>("/api/settings/integrations/evon/check"),
    onSuccess: (r) =>
      toast(r.reachable ? "ok" : r.reachable === null ? "info" : "alert", r.reachable ? `Evon reachable (${r.latency_ms} ms)` : r.message ?? "Evon unreachable"),
    onError: (e) => toast("alert", errorText(e)),
  });
  const retention = useMutation({
    mutationFn: () => api.post<{ deleted: number; retained: number }>("/api/admin/retention/run"),
    onSuccess: (r) => toast("ok", `Retention applied: ${r.deleted} deleted, ${r.retained} retained`),
    onError: (e) => toast("alert", errorText(e)),
  });

  if (isLoading) return <Skeleton className="h-48" />;
  if (error || !data) return <ErrorBox error={error} />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {data.providers.map((p, i) => {
          const Icon = PROVIDER_ICON[p.provider];
          const live = p.mode === "live";
          return (
            <Card key={p.provider} delay={i * 0.06}>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="group flex items-center gap-2">
                    <Icon size={22} className="text-brass" />
                    <span className="font-display text-sm font-bold uppercase tracking-wide">{p.provider}</span>
                  </div>
                  <Pill tone={live ? "ok" : p.mode === "disabled" ? "mute" : "warn"} dot>{p.mode}</Pill>
                </div>
                <div className="text-xs text-ink-dim">{p.purpose}</div>
                <div className="font-mono text-[11px] text-ink-mute">{p.model}</div>
                <div className={`text-xs ${live ? "text-ok" : "text-warn"}`}>{p.label}</div>
                <div className="border-t border-line pt-3 text-[11px] text-ink-mute">
                  {p.last_call ? (
                    <>
                      Last call {timeAgo(p.last_call.at)} · {p.last_call.status} ({p.last_call.mode})
                      {p.last_call.latency_ms != null && ` · ${p.last_call.latency_ms} ms`}
                    </>
                  ) : (
                    "No calls yet"
                  )}
                  {p.last_failure && <div className="text-alert">Last failure {timeAgo(p.last_failure.at)} · {p.last_failure.error_code}</div>}
                  {p.mode === "live" && !p.credentials_configured && <div className="text-alert">API key missing on the server</div>}
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
            <div className="text-[11px] uppercase tracking-wider text-ink-mute">Max recording</div>
            <div className="font-mono">{data.audio.max_seconds}s · {fileSize(data.audio.max_bytes)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-mute">Audio retention</div>
            <div className="font-mono">{data.audio.retention_days} days</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-mute">Formats</div>
            <div className="font-mono text-xs">{data.audio.accepted_formats.join(" · ")}</div>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-mute">{data.privacy_notice} Recordings are deleted automatically after the retention period; transcripts and incidents are kept.</p>
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

function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<User[]>("/api/users") });
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "technician" as Role });
  const create = useMutation({
    mutationFn: () => api.post<User>("/api/users", form),
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast("ok", `${u.name} added`);
      setForm({ name: "", email: "", password: "", role: "technician" });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; is_active?: boolean }) => api.patch(`/api/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) => toast("alert", errorText(e)),
  });
  const isAdmin = me?.role === "admin";

  return (
    <Panel title="Team" icon={<UsersIcon size={18} />}>
      {users.error ? (
        <ErrorBox error={users.error} />
      ) : (
        <ul className="divide-y divide-line">
          {users.data?.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  {u.name} {u.id === me?.id && <span className="text-xs text-ink-mute">(you)</span>}
                </div>
                <div className="truncate text-xs text-ink-mute">{u.email}</div>
              </div>
              {isAdmin && u.id !== me?.id ? (
                <>
                  <Select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })} className="!h-8 !w-36 text-xs">
                    {["technician", "supervisor", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  <Button3D size="sm" variant={u.is_active ? "ghost" : "neutral"} onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}>
                    {u.is_active ? "Deactivate" : "Reactivate"}
                  </Button3D>
                </>
              ) : (
                <Pill tone="brass">{u.role}</Pill>
              )}
              {!u.is_active && <Pill tone="alert">inactive</Pill>}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && (
        <form
          className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Input required placeholder="Name" aria-label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input required type="email" placeholder="Email" aria-label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input required type="password" minLength={8} placeholder="Temporary password" aria-label="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select aria-label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {["technician", "supervisor", "admin"].map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
          <Button3D type="submit" variant="dark" loading={create.isPending}>Add member</Button3D>
          {create.error && <div className="sm:col-span-2 lg:col-span-5"><ErrorBox error={create.error} /></div>}
        </form>
      )}
    </Panel>
  );
}

function Password() {
  const toast = useToast();
  const [f, setF] = useState({ current_password: "", new_password: "" });
  const change = useMutation({
    mutationFn: () => api.post("/api/auth/change-password", f),
    onSuccess: () => {
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

export default function Settings() {
  const { can } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader kicker="Configuration" title="Settings" icon={<GearIcon size={28} />} />
      <Integrations />
      {can("admin", "supervisor") && <Users />}
      <Password />
    </div>
  );
}
