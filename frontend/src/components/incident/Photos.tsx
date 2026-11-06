import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { t } from "../../lib/i18n";
import type { PhotoAsset } from "../../lib/types";
import { CameraIcon, TrashIcon, UploadIcon, XIcon } from "../icons/MachineIcons";
import { Button3D } from "../ui/Button3D";

const MAX_EDGE = 1600;

/** Shrink a phone photo before upload: large camera files are slow on mobile data. */
export async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // the server still validates the bytes
  }
}

export async function uploadPhotos(incidentId: string, files: File[]) {
  if (!files.length) return [];
  const form = new FormData();
  for (const f of await Promise.all(files.map(downscale))) form.append("files", f, f.name);
  return api.upload<PhotoAsset[]>(`/api/incidents/${incidentId}/photos`, form);
}

/** Camera and gallery buttons. On phones "Take photo" opens the rear camera directly. */
export function PhotoButtons({ onPick, disabled }: { onPick: (files: File[]) => void; disabled?: boolean }) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    onPick(Array.from(e.target.files ?? []));
    e.target.value = "";
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Button3D type="button" variant="dark" icon={<CameraIcon size={18} />} disabled={disabled} onClick={() => camera.current?.click()}>
        Take photo
      </Button3D>
      <Button3D type="button" variant="neutral" icon={<UploadIcon size={16} />} disabled={disabled} onClick={() => gallery.current?.click()}>
        From gallery
      </Button3D>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={pick} />
    </div>
  );
}

/** Thumbnails for photos not uploaded yet. */
export function PendingPhotos({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f));
    setUrls(next);
    return () => next.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  if (!files.length) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((u, i) => (
        <div key={u} className="relative aspect-square overflow-hidden rounded-lg bg-sunk">
          <img src={u} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label={t("Remove")}
            onClick={() => onRemove(i)}
            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-espresso/75 text-cream"
          >
            <XIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function useAuthedImage(incidentId: string, photoId: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    api.blob("GET", `/api/incidents/${incidentId}/photos/${photoId}`).then(({ blob }) => {
      made = URL.createObjectURL(blob);
      setUrl(made);
    }).catch(() => setUrl(null));
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [incidentId, photoId]);
  return url;
}

function Thumb({ incidentId, photo, onOpen }: { incidentId: string; photo: PhotoAsset; onOpen: (url: string) => void }) {
  const url = useAuthedImage(incidentId, photo.id);
  return (
    <button type="button" onClick={() => url && onOpen(url)} className="aspect-square overflow-hidden rounded-lg bg-sunk">
      {url ? <img src={url} alt={t("Fault photo")} className="h-full w-full object-cover" /> : <div className="skeleton h-full w-full" />}
    </button>
  );
}

/** Photos saved on an incident, with a full-screen viewer. */
export function PhotoGallery({ incidentId, photos, canDelete, onDelete }: { incidentId: string; photos: PhotoAsset[]; canDelete?: (p: PhotoAsset) => boolean; onDelete?: (p: PhotoAsset) => void }) {
  const [open, setOpen] = useState<{ url: string; photo: PhotoAsset } | null>(null);
  if (!photos.length) return <p className="text-sm text-ink-mute">{t("No photos yet.")}</p>;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p) => (
          <Thumb key={p.id} incidentId={incidentId} photo={p} onOpen={(url) => setOpen({ url, photo: p })} />
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <div className="flex justify-end gap-2 p-3" onClick={(e) => e.stopPropagation()}>
              {onDelete && canDelete?.(open.photo) && (
                <Button3D size="sm" variant="danger" icon={<TrashIcon size={14} />} onClick={() => { onDelete(open.photo); setOpen(null); }}>
                  Delete
                </Button3D>
              )}
              <button aria-label={t("Close")} onClick={() => setOpen(null)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white">
                <XIcon size={18} />
              </button>
            </div>
            <img src={open.url} alt={t("Fault photo")} className="m-auto max-h-[85vh] max-w-full object-contain px-3 pb-6" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
