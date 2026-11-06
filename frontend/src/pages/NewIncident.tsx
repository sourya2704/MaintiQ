import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CameraIcon, KeyboardIcon, MachineTypeIcon, MicIcon, UploadIcon } from "../components/icons/MachineIcons";
import { PendingPhotos, PhotoButtons, uploadPhotos } from "../components/incident/Photos";
import { Recorder } from "../components/incident/Recorder";
import { PageHeader } from "../components/layout/AppShell";
import { Button3D } from "../components/ui/Button3D";
import { ErrorBox, Field, Panel, Select, Textarea, errorText, useToast } from "../components/ui/kit";
import { api } from "../lib/api";
import { fileSize } from "../lib/format";
import { currentLang, t } from "../lib/i18n";
import type { IncidentDetail, IntegrationStatus, Machine, Page } from "../lib/types";

type Mode = "record" | "upload" | "type";
const LANGS = [
  { v: "en-IN", l: "English (India)" },
  { v: "hi-IN", l: "Hindi" },
  { v: "indic-auto", l: "Auto-detect Indian language" },
];

export default function NewIncident() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [machineId, setMachineId] = useState(params.get("machine") ?? "");
  const startMode = params.get("mode");
  const [mode, setMode] = useState<Mode>(startMode === "type" || startMode === "upload" ? startMode : "record");
  const [photos, setPhotos] = useState<File[]>([]);
  const photoPanel = useRef<HTMLDivElement>(null);
  // "Take photos" on the home screen lands here with the photo step in view.
  useEffect(() => {
    if (startMode === "photo") photoPanel.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [startMode]);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  // Hindi users usually speak Hindi: default the voice-note language to match the interface.
  const [lang, setLang] = useState(currentLang() === "hi" ? "hi-IN" : "en-IN");
  const [drag, setDrag] = useState(false);
  // One key per draft: a double-submit or network retry returns the same incident.
  const idempotencyKey = useMemo(() => crypto.randomUUID(), [machineId, mode, file, text]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileInput = useRef<HTMLInputElement>(null);

  const machines = useQuery({ queryKey: ["machines", "all"], queryFn: () => api.get<Page<Machine>>("/api/machines", { page_size: 100 }) });
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => api.get<IntegrationStatus>("/api/settings/integrations") });
  const prisma = integrations.data?.providers.find((p) => p.provider === "prisma");
  const selected = machines.data?.items.find((m) => m.id === machineId);

  const submit = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("machine_id", machineId);
      form.set("language_code", lang);
      if (mode === "type") form.set("transcript", text.trim());
      else if (file) form.set("audio_file", file, file.name);
      return api.upload<IncidentDetail>("/api/incidents", form, { "Idempotency-Key": idempotencyKey });
    },
    onSuccess: async (inc) => {
      if (photos.length) {
        try {
          await uploadPhotos(inc.id, photos);
        } catch (e) {
          toast("alert", errorText(e));
        }
      }
      qc.invalidateQueries({ queryKey: ["incidents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("ok", mode === "type" ? "Incident created" : "Voice note uploaded. Transcribing with Prisma…");
      navigate(`/incidents/${inc.id}`);
    },
  });

  const ready = Boolean(machineId) && (mode === "type" ? text.trim().length > 3 : Boolean(file));

  const tabs: { id: Mode; label: string; icon: typeof MicIcon }[] = [
    { id: "record", label: "Record", icon: MicIcon },
    { id: "upload", label: "Upload", icon: UploadIcon },
    { id: "type", label: "Type", icon: KeyboardIcon },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker="New incident" title="Report a fault" icon={<MicIcon size={28} />} />

      <div className="space-y-6">
        <Panel title="1. Machine" icon={<MachineTypeIcon type={selected?.type ?? ""} size={18} />}>
          <Field label="Which machine?" hint={selected ? <>{`${selected.type}${selected.location ? ` · ${selected.location}` : ""}`}</> : undefined}>
            <Select value={machineId} onChange={(e) => setMachineId(e.target.value)} required>
              <option value="">{t("Select a machine…")}</option>
              {machines.data?.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.asset_code} — {m.name}
                </option>
              ))}
            </Select>
          </Field>
          {machines.data?.items.length === 0 && (
            <p className="mt-3 text-sm text-ink-mute">
              {t("No machines yet.")}{" "}
              <button className="text-brass underline" onClick={() => navigate("/machines")}>
                {t("Add one first")}
              </button>
              .
            </p>
          )}
        </Panel>

        <Panel
          title="2. Describe the fault"
          icon={<MicIcon size={18} />}
          actions={
            mode !== "type" && (
              <Select aria-label={t("Spoken language")} value={lang} onChange={(e) => setLang(e.target.value)} className="!h-8 !w-auto !py-0 text-xs">
                {LANGS.map((l) => (
                  <option key={l.v} value={l.v}>
                    {t(l.l)}
                  </option>
                ))}
              </Select>
            )
          }
        >
          <div className="mb-5 grid grid-cols-3 gap-2" role="tablist">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => {
                  setMode(id);
                  setFile(null);
                }}
                className={`group flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition ${
                  mode === id ? "border-rust/60 bg-rust/10 text-rust" : "border-line text-ink-dim hover:border-line-strong hover:text-ink"
                }`}
              >
                <Icon size={17} /> {t(label)}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {mode === "record" && <Recorder onRecorded={setFile} disabled={submit.isPending} />}
              {mode === "upload" && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    setFile(e.dataTransfer.files[0] ?? null);
                  }}
                  onClick={() => fileInput.current?.click()}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
                  role="button"
                  tabIndex={0}
                  className={`group flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                    drag ? "border-brass bg-brass/10" : "border-line hover:border-brass/60"
                  }`}
                >
                  <UploadIcon size={40} className="text-brass transition group-hover:-translate-y-1" />
                  {file ? (
                    <div>
                      <div className="font-semibold">{file.name}</div>
                      <div className="text-xs text-ink-mute">{fileSize(file.size)}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-ink-dim">{t("Drop a recording here or click to choose")}</div>
                  )}
                  <div className="text-xs text-ink-mute">
                    {integrations.data
                      ? t("{formats} · up to {seconds}s · {size}", {
                          formats: integrations.data.audio.accepted_formats.join(", ").toUpperCase(),
                          seconds: integrations.data.audio.max_seconds,
                          size: fileSize(integrations.data.audio.max_bytes),
                        })
                      : "WAV, MP3, OGG, FLAC, AAC, M4A, WEBM"}
                  </div>
                  <input ref={fileInput} type="file" accept="audio/*,.wav,.mp3,.ogg,.flac,.aac,.m4a,.webm" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
              )}
              {mode === "type" && (
                <Field label="Describe the fault" hint="Used when recording isn't possible. Saved as a manual transcript, not a Prisma one.">
                  <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Motor M-104 vibrating more than usual, housing hot. Checked belt tension, fine…")} />
                </Field>
              )}
            </motion.div>
          </AnimatePresence>
        </Panel>

        <div ref={photoPanel} className={`rounded-xl ${startMode === "photo" ? "ring-2 ring-rust/50" : ""}`}>
          <Panel title="3. Photos" icon={<CameraIcon size={18} />} tag={<span className="text-xs text-ink-mute">{t("optional")}</span>}>
            <p className="mb-3 text-sm text-ink-dim">{t("Photograph the damaged part, the leak, a gauge or the fault code on the display.")}</p>
            <PhotoButtons disabled={submit.isPending || photos.length >= 8} onPick={(f) => setPhotos((p) => [...p, ...f].slice(0, 8))} />
            <PendingPhotos files={photos} onRemove={(i) => setPhotos((p) => p.filter((_, j) => j !== i))} />
          </Panel>
        </div>

        {submit.error && <ErrorBox error={submit.error} />}
        <div className="flex flex-col items-center gap-3">
          <Button3D variant="primary" size="lg" disabled={!ready} loading={submit.isPending} onClick={() => submit.mutate()} icon={<MicIcon size={18} />}>
            {mode === "type" ? "Create incident" : "Submit voice note"}
          </Button3D>
          {mode !== "type" && prisma && (
            <p className="text-center text-xs text-ink-mute">
              {t(
                prisma.mode === "live"
                  ? "Audio is transcribed by Gnani Prisma (live). It is sent to Gnani for processing."
                  : "Prisma is in MOCK mode: the transcript will be a labelled local fixture.",
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
