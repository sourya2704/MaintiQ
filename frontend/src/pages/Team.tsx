import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { CheckIcon, PlusIcon, UsersIcon } from "../components/icons/MachineIcons";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ConfirmDialog, EmptyState, ErrorBox, Field, Input, Panel, Pill, Select, Skeleton, errorText, useToast } from "../components/ui/kit";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate, timeAgo } from "../lib/format";
import { t } from "../lib/i18n";
import type { AccountIssued, Role, TeamMember } from "../lib/types";

const ROLES: Role[] = ["technician", "supervisor", "admin"];
const ROLE_TONE = { admin: "rust", supervisor: "brass", technician: "mute" } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The login and one-time password, shown once so the admin can hand them over. */
function IssuedDialog({ issued, title, onClose }: { issued: AccountIssued; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `${t("Mantiq login")}\n${t("Email")}: ${issued.login_email}\n${t("Password")}: ${issued.temporary_password}\n${t("You will be asked to set your own password at first sign-in.")}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/50 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div role="dialog" aria-modal="true" aria-label={t(title)} initial={{ y: 24 }} animate={{ y: 0 }} className="surface w-full max-w-md space-y-4 rounded-t-2xl p-6 sm:rounded-2xl">
        <h3 className="font-display text-xl font-semibold">{t(title)}</h3>
        <p className="text-sm text-ink-dim">
          {t("Give these to {name}. The password is shown only now; they set their own at first sign-in.", { name: issued.user.name })}
        </p>
        <dl className="space-y-3 rounded-lg bg-sunk p-4">
          <div>
            <dt className="text-xs font-medium text-ink-mute">{t("Login email")}</dt>
            <dd className="select-all break-all font-mono text-[15px] font-semibold text-ink">{issued.login_email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-mute">{t("One-time password")}</dt>
            <dd className="select-all font-mono text-lg font-semibold tracking-wider text-ink">{issued.temporary_password}</dd>
          </div>
        </dl>
        <div className="flex justify-end gap-2">
          <Button3D variant="neutral" icon={copied ? <CheckIcon size={16} /> : undefined} onClick={copy}>
            {copied ? "Copied" : "Copy both"}
          </Button3D>
          <Button3D variant="primary" onClick={onClose}>
            Done
          </Button3D>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddWorker({ onIssued }: { onIssued: (a: AccountIssued) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", role: "technician" as Role, ownEmail: false, email: "" });
  const create = useMutation({
    mutationFn: () => api.post<AccountIssued>("/api/users", { name: form.name, role: form.role, email: form.ownEmail ? form.email : null }),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setForm({ name: "", role: "technician", ownEmail: false, email: "" });
      onIssued(a);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <Field label="Full name">
          <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("e.g. Ravi Kumar")} />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {cap(t(r))}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-dim">
        <input type="checkbox" checked={form.ownEmail} onChange={(e) => setForm({ ...form, ownEmail: e.target.checked })} className="accent-[var(--color-rust)]" />
        {t("Use their own email instead of a company login")}
      </label>
      {form.ownEmail && (
        <Field label="Email">
          <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
      )}
      {create.error && <ErrorBox error={create.error} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-mute">{t("Mantiq creates the login and a one-time password for you to hand over.")}</p>
        <Button3D type="submit" variant="primary" icon={<PlusIcon size={16} />} loading={create.isPending}>
          Add worker
        </Button3D>
      </div>
    </form>
  );
}

export default function Team() {
  const { user: me, can } = useAuth();
  const isAdmin = me?.role === "admin";
  const qc = useQueryClient();
  const toast = useToast();
  const [issued, setIssued] = useState<{ a: AccountIssued; title: string } | null>(null);
  const [resetting, setResetting] = useState<TeamMember | null>(null);
  const [filter, setFilter] = useState<"all" | Role>("all");
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<TeamMember[]>("/api/users") });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; is_active?: boolean }) => api.patch(`/api/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) => toast("alert", errorText(e)),
  });
  const reset = useMutation({
    mutationFn: (u: TeamMember) => api.post<AccountIssued>(`/api/users/${u.id}/reset-password`),
    onSuccess: (a) => {
      setResetting(null);
      setIssued({ a, title: "New one-time password" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast("alert", errorText(e)),
  });

  const all = users.data ?? [];
  const active = all.filter((u) => u.is_active);
  const shown = all.filter((u) => filter === "all" || u.role === filter);
  const counts = ROLES.map((r) => [r, active.filter((u) => u.role === r).length] as const);

  if (!can("admin", "supervisor")) return <EmptyState title="Only supervisors and admins can see the team." />;

  return (
    <div className="space-y-6">
      <PageHeader kicker={me?.organization?.name} title="Team" icon={<UsersIcon size={26} />} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface rounded-xl p-4">
          <div className="text-[13px] font-medium text-ink-mute">{t("Active people")}</div>
          <div className="mt-1 font-display text-3xl font-bold text-ink">{active.length}</div>
        </div>
        {counts.map(([r, n]) => (
          <button
            key={r}
            onClick={() => setFilter(filter === r ? "all" : r)}
            className={`surface rounded-xl p-4 text-left transition ${filter === r ? "!border-rust ring-1 ring-rust/30" : "hover:border-line-strong"}`}
          >
            <div className="text-[13px] font-medium text-ink-mute">{cap(t(`${r}s`))}</div>
            <div className="mt-1 font-display text-3xl font-bold text-ink">{n}</div>
          </button>
        ))}
      </div>

      {isAdmin && (
        <Panel title="Add a worker" icon={<PlusIcon size={18} />}>
          <AddWorker onIssued={(a) => setIssued({ a, title: "Account created" })} />
        </Panel>
      )}

      <Panel title={filter === "all" ? "Everyone" : `${t(filter)}s`} icon={<UsersIcon size={18} />}>
        {users.error && <ErrorBox error={users.error} />}
        {users.isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            {/* wide screens: a table */}
            <div className="-mx-5 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs text-ink-mute">
                  <tr>
                    {["Name", "Role", "Login email", "Joined", "Last sign-in", "Reports", ""].map((h) => (
                      <th key={h} className="whitespace-nowrap px-5 py-2 font-medium">
                        {h && t(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {shown.map((u) => (
                    <tr key={u.id} className={u.is_active ? "" : "opacity-55"}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-ink">
                          {u.name} {u.id === me?.id && <span className="text-xs font-normal text-ink-mute">({t("you")})</span>}
                        </div>
                        {!u.is_active && <Pill tone="alert">Inactive</Pill>}
                        {u.is_active && u.must_change_password && <Pill tone="warn">Has not signed in yet</Pill>}
                      </td>
                      <td className="px-5 py-3">
                        {isAdmin && u.id !== me?.id ? (
                          <Select aria-label={t("Role for {name}", { name: u.name })} value={u.role} onChange={(e) => update.mutate({ id: u.id, role: e.target.value as Role })} className="!h-8 !w-36 text-xs">
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {cap(t(r))}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Pill tone={ROLE_TONE[u.role]}>{u.role}</Pill>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-dim">{u.email}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-dim">{fmtDate(u.created_at)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-ink-dim">{u.last_login_at ? timeAgo(u.last_login_at) : t("Never")}</td>
                      <td className="px-5 py-3 font-mono text-ink">{u.reports}</td>
                      <td className="px-5 py-3 text-right">
                        {isAdmin && u.id !== me?.id && (
                          <div className="flex justify-end gap-1">
                            <Button3D size="sm" variant="ghost" onClick={() => setResetting(u)}>
                              Reset password
                            </Button3D>
                            <Button3D size="sm" variant="ghost" onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}>
                              {u.is_active ? "Deactivate" : "Reactivate"}
                            </Button3D>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* phones: one card per person */}
            <ul className="space-y-3 md:hidden">
              {shown.map((u) => (
                <li key={u.id} className={`rounded-xl border border-line bg-sunk/50 p-4 ${u.is_active ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-ink">{u.name}</div>
                      <div className="break-all font-mono text-xs text-ink-dim">{u.email}</div>
                    </div>
                    <Pill tone={ROLE_TONE[u.role]}>{u.role}</Pill>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-ink-mute">{t("Joined")}</dt>
                      <dd className="text-ink">{fmtDate(u.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">{t("Last sign-in")}</dt>
                      <dd className="text-ink">{u.last_login_at ? timeAgo(u.last_login_at) : t("Never")}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-mute">{t("Reports")}</dt>
                      <dd className="text-ink">{u.reports}</dd>
                    </div>
                  </dl>
                  {isAdmin && u.id !== me?.id && (
                    <div className="mt-3 flex gap-2">
                      <Button3D size="sm" variant="neutral" onClick={() => setResetting(u)}>
                        Reset password
                      </Button3D>
                      <Button3D size="sm" variant="ghost" onClick={() => update.mutate({ id: u.id, is_active: !u.is_active })}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </Button3D>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <ConfirmDialog
        open={resetting !== null}
        title="Reset this password?"
        body={t("{name} gets a new one-time password and is signed out everywhere.", { name: resetting?.name ?? "" })}
        confirmLabel="Reset password"
        busy={reset.isPending}
        onConfirm={() => resetting && reset.mutate(resetting)}
        onClose={() => setResetting(null)}
      />
      <AnimatePresence>{issued && <IssuedDialog issued={issued.a} title={issued.title} onClose={() => setIssued(null)} />}</AnimatePresence>
    </div>
  );
}
