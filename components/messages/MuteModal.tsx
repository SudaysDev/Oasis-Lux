"use client";

import { Bell, BellOff, Clock } from "lucide-react";
import { Modal } from "./overlays";
import { cn } from "@/lib/utils";

const HOUR = 60 * 60 * 1000;
const OPTIONS: { label: string; ms: number | null }[] = [
  { label: "Mute for 1 hour", ms: HOUR },
  { label: "Mute for 8 hours", ms: 8 * HOUR },
  { label: "Mute for 2 days", ms: 2 * 24 * HOUR },
  { label: "Mute forever", ms: null },
];

export function MuteModal({
  open,
  onClose,
  peerName,
  muted,
  onMute,
  onUnmute,
}: {
  open: boolean;
  onClose: () => void;
  peerName: string;
  muted: boolean;
  onMute: (durationMs: number | null) => void;
  onUnmute: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><BellOff className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">Mute notifications</h3>
          <p className="truncate text-xs text-fg-muted">{peerName}</p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => { onMute(o.ms); onClose(); }}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--panel-border)] px-3 py-2.5 text-left text-sm transition hover:border-accent/50 hover:bg-[var(--panel)]"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--panel)] text-fg-muted">
              {o.ms === null ? <BellOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </span>
            {o.label}
          </button>
        ))}
        {muted && (
          <button
            type="button"
            onClick={() => { onUnmute(); onClose(); }}
            className={cn("flex w-full items-center gap-3 rounded-xl border border-success/40 px-3 py-2.5 text-left text-sm font-semibold text-success transition hover:bg-success/10")}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success/10"><Bell className="h-4 w-4" /></span>
            Unmute
          </button>
        )}
      </div>
    </Modal>
  );
}
