import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { t } from "../../lib/i18n";
import { MicIcon, RefreshIcon, StopIcon } from "../icons/MachineIcons";
import { Button3D } from "../ui/Button3D";

const MAX_SECONDS = 120;

function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/**
 * Voice-note recorder with a 3D push-to-record button. Mic level drives
 * the pulse rings and the live waveform. Produces a File ready for upload.
 */
export function Recorder({ onRecorded, disabled }: { onRecorded: (file: File | null) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);
  const timer = useRef<number>(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const cleanup = () => {
    cancelAnimationFrame(raf.current);
    clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    ctx.current?.close().catch(() => {});
    ctx.current = null;
  };
  useEffect(() => () => {
    cleanup();
    if (url) URL.revokeObjectURL(url);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = (analyser: AnalyserNode) => {
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
      const c = canvas.current;
      if (c) {
        const g = c.getContext("2d")!;
        const w = (c.width = c.clientWidth * devicePixelRatio);
        const h = (c.height = c.clientHeight * devicePixelRatio);
        g.clearRect(0, 0, w, h);
        const bars = 48;
        const step = Math.floor(data.length / bars);
        for (let i = 0; i < bars; i++) {
          const v = Math.abs(data[i * step] - 128) / 128;
          const bh = Math.max(2 * devicePixelRatio, v * h * 1.8);
          const grad = g.createLinearGradient(0, h / 2 - bh / 2, 0, h / 2 + bh / 2);
          grad.addColorStop(0, "#5b84ad");
          grad.addColorStop(1, "#2e5e8c");
          g.fillStyle = grad;
          const bw = w / bars - 2 * devicePixelRatio;
          g.fillRect(i * (w / bars), h / 2 - bh / 2, bw, bh);
        }
      }
      raf.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const start = async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = pickMime();
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        const type = r.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: type.split(";")[0] });
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        onRecorded(file);
        setState("done");
        cleanup();
      };
      ctx.current = new AudioContext();
      const analyser = ctx.current.createAnalyser();
      analyser.fftSize = 1024;
      ctx.current.createMediaStreamSource(s).connect(analyser);
      draw(analyser);
      r.start(250);
      rec.current = r;
      setSeconds(0);
      setState("recording");
      const startedAt = Date.now();
      timer.current = window.setInterval(() => {
        const secs = (Date.now() - startedAt) / 1000;
        setSeconds(secs);
        if (secs >= MAX_SECONDS) stop();
      }, 200);
    } catch {
      setError(t("Microphone access was blocked. Allow microphone access, or upload a file instead."));
      cleanup();
    }
  };

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
    setLevel(0);
  };

  const reset = () => {
    onRecorded(null);
    setState("idle");
    setSeconds(0);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
  };

  const recording = state === "recording";
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <div className="relative grid h-44 w-44 place-items-center" style={{ perspective: 600 }}>
        {recording &&
          [0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute inset-4 rounded-full border-2 border-rust/40"
              style={{ animation: `pulse-ring 1.8s ${i * 0.6}s ease-out infinite` }}
            />
          ))}
        <motion.span
          aria-hidden
          className="absolute inset-7 rounded-full bg-rust/15"
          animate={{ scale: 1 + level * 0.5 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
        <motion.button
          type="button"
          disabled={disabled || state === "done"}
          onClick={recording ? stop : start}
          aria-label={t(recording ? "Stop recording" : "Start recording")}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.94, y: 6 }}
          className="group relative h-32 w-32 rounded-full disabled:opacity-40"
          style={{ transformStyle: "preserve-3d" }}
        >
          <span className="absolute inset-0 translate-y-1.5 rounded-full bg-rust-deep" />
          <span
            className={`absolute inset-0 grid place-items-center rounded-full border-2 transition-colors ${
              recording ? "border-[#7a1a12] bg-alert" : "border-rust-deep bg-rust"
            }`}
          >
            {recording ? <StopIcon size={44} className="text-cream" /> : <MicIcon size={46} className="text-cream" />}
          </span>
        </motion.button>
      </div>

      <div className="font-mono text-2xl tabular-nums tracking-widest text-ink">
        {Math.floor(seconds / 60)}:{String(Math.floor(seconds % 60)).padStart(2, "0")}
        <span className="ml-2 text-xs text-ink-mute">/ 2:00</span>
      </div>
      <canvas ref={canvas} className={`h-14 w-full max-w-md ${recording ? "opacity-100" : "opacity-30"}`} aria-hidden />
      <p className="text-center text-xs text-ink-mute">
        {t(
          recording
            ? "Describe what you see, hear and have already checked. Tap to stop."
            : state === "done"
              ? "Recorded. Play it back, then submit, or record again."
              : "Tap the button and describe the fault: machine, symptoms, what you checked.",
        )}
      </p>
      {state === "done" && url && (
        <div className="flex w-full max-w-md items-center gap-3">
          <audio controls src={url} className="h-10 flex-1" />
          <Button3D size="sm" variant="neutral" icon={<RefreshIcon size={14} />} onClick={reset}>
            Redo
          </Button3D>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-alert">{error}</p>}
    </div>
  );
}
