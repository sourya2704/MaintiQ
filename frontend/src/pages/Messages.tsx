import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FixCard } from "../components/FixCard";
import { ArrowLeft, ChatIcon, ChevronRight } from "../components/icons/MachineIcons";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { EmptyState, ErrorBox, Skeleton, Textarea, errorText, useToast } from "../components/ui/kit";
import { api } from "../lib/api";
import { fmtDate, timeAgo } from "../lib/format";
import { t } from "../lib/i18n";
import type { Contact, Message } from "../lib/types";

const initials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-espresso text-xs font-bold text-cream" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}

function ContactList({ contacts, active }: { contacts: Contact[]; active?: string }) {
  if (!contacts.length) return <EmptyState title="No one to message yet" body="Ask an admin to add your team in Settings." />;
  return (
    <ul className="divide-y divide-line">
      {contacts.map((c) => (
        <li key={c.id}>
          <Link to={`/messages/${c.id}`} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-sunk/60 ${active === c.id ? "bg-sunk" : ""}`}>
            <Avatar name={c.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span>
              <span className="block text-xs text-ink-mute">
                {t(c.role)}
                {c.last_at ? ` · ${timeAgo(c.last_at)}` : ""}
              </span>
            </span>
            {c.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-rust px-1.5 text-xs font-bold text-cream">{c.unread}</span>}
            <ChevronRight size={16} className="text-ink-mute lg:hidden" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Bubble({ m }: { m: Message }) {
  const [original, setOriginal] = useState(false);
  return (
    <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${m.mine ? "rounded-br-md bg-espresso text-cream" : "rounded-bl-md surface"}`}>
        {m.kind === "fix" && m.fix && (
          <div className={m.mine ? "rounded-xl bg-card p-3 text-ink" : ""}>
            <FixCard fix={m.fix} incidentId={m.incident_id} incidentLabel={m.incident_label} />
          </div>
        )}
        {(original ? m.original_body : m.body) && (
          <p className={`whitespace-pre-wrap text-[15px] ${m.kind === "fix" ? "mt-3" : ""}`}>{original ? m.original_body : m.body}</p>
        )}
        <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-[11px] ${m.mine ? "text-cream/55" : "text-ink-mute"}`}>
          <span>{fmtDate(m.created_at, true)}</span>
          {m.translated && (
            <button type="button" onClick={() => setOriginal((o) => !o)} className="underline underline-offset-2">
              {original ? t("Show translation") : t("Translated. Show original")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Thread({ contact }: { contact: Contact }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const thread = useQuery({
    queryKey: ["messages", contact.id],
    queryFn: () => api.get<Message[]>("/api/messages", { with: contact.id }),
    refetchInterval: 15_000,
  });
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    qc.invalidateQueries({ queryKey: ["unread"] });
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }, [thread.data?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({
    mutationFn: () => api.post<Message>("/api/messages", { recipient_id: contact.id, body: text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", contact.id] });
    },
    onError: (e) => toast("alert", errorText(e)),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) send.mutate();
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to="/messages" aria-label={t("Back")} className="text-ink-mute lg:hidden">
          <ArrowLeft size={20} />
        </Link>
        <Avatar name={contact.name} size={36} />
        <div>
          <div className="font-semibold text-ink">{contact.name}</div>
          <div className="text-xs text-ink-mute">{t(contact.role)}</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {thread.error && <ErrorBox error={thread.error} onRetry={() => thread.refetch()} />}
        {thread.isLoading ? (
          <Skeleton className="h-40" />
        ) : thread.data?.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-mute">{t("No messages yet. Say hello.")}</p>
        ) : (
          thread.data?.map((m) => <Bubble key={m.id} m={m} />)
        )}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        <Textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) submit(e);
          }}
          placeholder={t("Write a message…")}
          aria-label={t("Write a message…")}
          className="!min-h-11 flex-1"
        />
        <Button3D type="submit" variant="primary" loading={send.isPending} disabled={!text.trim()}>
          Send
        </Button3D>
      </form>
    </div>
  );
}

export default function Messages() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<Contact[]>("/api/messages/contacts"),
    refetchInterval: 30_000,
  });
  const active = contacts.data?.find((c) => c.id === userId);
  useEffect(() => {
    if (userId && contacts.data && !active) navigate("/messages", { replace: true });
  }, [userId, contacts.data, active, navigate]);

  return (
    <div>
      <div className={userId ? "hidden lg:block" : ""}>
        <PageHeader title="Messages" icon={<ChatIcon size={26} />} />
      </div>
      {contacts.error && <ErrorBox error={contacts.error} />}
      <div className="surface grid overflow-hidden rounded-xl lg:h-[calc(100vh-11rem)] lg:grid-cols-[300px_1fr]">
        <div className={`min-h-0 overflow-y-auto border-line lg:border-r ${userId ? "hidden lg:block" : ""}`}>
          {contacts.isLoading ? <Skeleton className="m-4 h-40" /> : <ContactList contacts={contacts.data ?? []} active={userId} />}
        </div>
        <div className={`min-h-0 ${userId ? "h-[calc(100dvh-11.5rem)] lg:h-auto" : "hidden lg:flex lg:items-center lg:justify-center"}`}>
          {active ? <Thread key={active.id} contact={active} /> : <p className="text-sm text-ink-mute">{t("Choose a person to start.")}</p>}
        </div>
      </div>
    </div>
  );
}
