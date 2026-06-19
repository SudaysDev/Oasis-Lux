"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Flag, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { REPORT_CATEGORIES, submitReport, type ReportCategory } from "@/lib/data/reports";
import { Avatar } from "@/components/profile/Avatar";
import { Modal } from "./overlays";
import { cn } from "@/lib/utils";
import type { MiniProfile } from "@/types";

export function ReportModal({
  open,
  onClose,
  meId,
  peer,
  conversationId,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  peer: MiniProfile;
  conversationId?: string | null;
}) {
  const [category, setCategory] = useState<ReportCategory>("spam");
  const [desc, setDesc] = useState("");
  const [sending, setSending] = useState(false);

  const close = () => { if (!sending) { onClose(); } };

  const submit = async () => {
    setSending(true);
    try {
      await submitReport(getBrowserClient(), {
        reporterId: meId,
        reportedId: peer.id,
        category,
        description: desc.trim(),
        conversationId,
      });
      toast.success("Report sent to moderators");
      setDesc("");
      setCategory("spam");
      onClose();
    } catch {
      toast.error("Couldn’t send report");
    } finally {
      setSending(false);
    }
  };

  const name = peer.fullName || `@${peer.username}`;

  return (
    <Modal open={open} onClose={close} className="max-w-md">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger">
          <Flag className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">Report {name}</h3>
          <p className="truncate text-xs text-fg-muted">Your report is private and goes to our moderators.</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-[var(--panel)] p-2.5">
        <Avatar src={peer.avatarUrl} name={peer.username} size={34} />
        <span className="truncate text-sm font-medium">@{peer.username}</span>
      </div>

      <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">Reason</p>
      <div className="space-y-1.5">
        {REPORT_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
              category === c.key
                ? "border-accent bg-accent/10 text-fg"
                : "border-[var(--panel-border)] text-fg-muted hover:border-accent/50",
            )}
          >
            <span
              className={cn(
                "grid h-4 w-4 place-items-center rounded-full border",
                category === c.key ? "border-accent" : "border-fg-muted/50",
              )}
            >
              {category === c.key && <span className="h-2 w-2 rounded-full bg-accent" />}
            </span>
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={3}
        placeholder="Add details (optional)…"
        className="field mt-3 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
      />

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={close}
          className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
          Submit report
        </button>
      </div>
    </Modal>
  );
}
