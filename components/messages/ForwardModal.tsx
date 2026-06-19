"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Search, Send, UserX } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchConversations, sendMessage, type ChatMessage, type ConversationSummary } from "@/lib/data/messages";
import { Avatar } from "@/components/profile/Avatar";
import { Modal } from "./overlays";
import { cn } from "@/lib/utils";

export function ForwardModal({
  open,
  onClose,
  meId,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  meId: string;
  messages: ChatMessage[];
}) {
  const sb = getBrowserClient();
  const [convs, setConvs] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [hideSender, setHideSender] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void fetchConversations(sb, meId)
      .then((c) => { if (!cancelled) setConvs(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, meId, sb]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return convs;
    return convs.filter((c) => c.peer.fullName.toLowerCase().includes(t) || c.peer.username.toLowerCase().includes(t));
  }, [convs, q]);

  // Forward in chronological order so the thread reads naturally in the target chat.
  const ordered = useMemo(
    () => [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [messages],
  );

  const forward = async (c: ConversationSummary) => {
    if (ordered.length === 0 || sendingTo) return;
    setSendingTo(c.id);
    try {
      for (const m of ordered) {
        // preserve original authorship through a forward chain (unless sender hidden)
        const origin = hideSender ? null : (m.forwardedFrom ?? m.senderId);
        await sendMessage(sb, c.id, meId, c.peer.id, m.text, m.attachments, null, origin);
      }
      const who = c.peer.fullName || "@" + c.peer.username;
      toast.success(ordered.length > 1 ? `${ordered.length} messages forwarded to ${who}` : `Forwarded to ${who}`);
      onClose();
    } catch {
      toast.error("Couldn’t forward");
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-sm">
      <h3 className="mb-3 text-lg font-bold">{ordered.length > 1 ? `Forward ${ordered.length} messages to…` : "Forward to…"}</h3>

      {/* forward settings — hide the original sender (message looks like yours) */}
      <button
        type="button"
        onClick={() => setHideSender((v) => !v)}
        className="mb-3 flex w-full items-center gap-2.5 rounded-xl border border-[var(--panel-border)] px-3 py-2.5 text-left text-sm transition hover:border-accent/50"
      >
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", hideSender ? "bg-accent/15 text-accent" : "bg-[var(--panel)] text-fg-muted")}>
          <UserX className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Hide sender name</span>
          <span className="block text-[11px] text-fg-muted">Forwarded messages will look like yours</span>
        </span>
        <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition", hideSender ? "bg-accent" : "bg-[var(--panel-border)]")}>
          <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: hideSender ? "1.25rem" : "0.125rem" }} />
        </span>
      </button>

      <div className="field mb-3 flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="h-4 w-4 text-fg-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      <div className="no-scrollbar -mx-1 max-h-72 overflow-y-auto px-1">
        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-fg-muted">No chats found.</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => void forward(c)}
              disabled={!!sendingTo}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-[var(--panel)] disabled:opacity-60",
              )}
            >
              <Avatar src={c.peer.avatarUrl} name={c.peer.username} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.peer.fullName || `@${c.peer.username}`}</p>
                <p className="truncate text-xs text-fg-muted">@{c.peer.username}</p>
              </div>
              {sendingTo === c.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <Send className="h-4 w-4 text-fg-muted" />
              )}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
