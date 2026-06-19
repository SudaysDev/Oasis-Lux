"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { Modal } from "./overlays";
import { cn } from "@/lib/utils";

export function ComposeMediaModal({
  open,
  files,
  sending,
  onAddMore,
  onRemove,
  onClose,
  onSend,
}: {
  open: boolean;
  files: File[];
  sending: boolean;
  onAddMore: () => void;
  onRemove: (index: number) => void;
  onClose: () => void;
  onSend: (caption: string) => void;
}) {
  const [caption, setCaption] = useState("");

  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), video: f.type.startsWith("video"), name: f.name })),
    [files],
  );
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);
  useEffect(() => { if (!open) setCaption(""); }, [open]);

  const single = files.length === 1;
  const title = files.length > 1 ? `Send ${files.length} items` : "Send media";

  return (
    <Modal open={open && files.length > 0} onClose={() => !sending && onClose()} className="max-w-md">
      <h3 className="mb-3 text-lg font-bold">{title}</h3>

      <div className={cn("grid gap-2", single ? "grid-cols-1" : "grid-cols-3")}>
        {previews.map((p, i) => (
          <div key={p.url} className={cn("group relative overflow-hidden rounded-xl bg-[var(--panel)]", single ? "max-h-72" : "aspect-square")}>
            {p.video ? (
              <video src={p.url} className={cn("w-full object-cover", single ? "max-h-72" : "h-full")} muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.url} alt={p.name} className={cn("w-full object-cover", single ? "max-h-72" : "h-full")} />
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label="Remove"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!single && (
          <button
            type="button"
            onClick={onAddMore}
            className="grid aspect-square place-items-center rounded-xl border border-dashed border-[var(--panel-border)] text-fg-muted transition hover:border-accent hover:text-accent"
          >
            <ImagePlus className="h-6 w-6" />
          </button>
        )}
      </div>

      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSend(caption); }}
        placeholder="Add a caption…"
        className="field mt-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
      />

      <div className="mt-4 flex items-center gap-2">
        {single && (
          <button
            type="button"
            onClick={onAddMore}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--panel-border)] px-3.5 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]"
          >
            <ImagePlus className="h-4 w-4" /> Add
          </button>
        )}
        <button
          type="button"
          onClick={() => !sending && onClose()}
          className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSend(caption)}
          disabled={sending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
        </button>
      </div>
    </Modal>
  );
}
