"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Ban, Flag, MessageSquare, MoreVertical, Pin, PinOff, Search, Trash2, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import {
  blockUser, clearConversationForMe, deleteConversation, fetchConversations,
  type ConversationSummary,
} from "@/lib/data/messages";
import { isChatPinned, loadPinnedChats, toggleChatPin } from "@/lib/saved-media";
import { useIsClient } from "@/hooks/useIsClient";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";
import { VerifiedBadge } from "@/components/profile/Badges";
import { ChatPane } from "@/components/messages/ChatPane";
import { Modal, Sheet, SheetItem } from "@/components/messages/overlays";
import { ReportModal } from "@/components/messages/ReportModal";
import type { MiniProfile } from "@/types";

export function MessagesView({
  meId,
  initial,
  activePeerId = null,
  activePeer,
}: {
  meId: string;
  initial: ConversationSummary[];
  activePeerId?: string | null;
  activePeer?: MiniProfile;
}) {
  const sb = getBrowserClient();
  const [conversations, setConversations] = useState<ConversationSummary[]>(initial);
  const [q, setQ] = useState("");

  // pinned chats (localStorage; hydration-safe via useIsClient)
  const isClient = useIsClient();
  const [pinOverride, setPinOverride] = useState<string[] | null>(null);
  const pinned = useMemo(
    () => pinOverride ?? (isClient ? loadPinnedChats(meId) : []),
    [pinOverride, isClient, meId],
  );
  const togglePin = (id: string) => { setPinOverride(toggleChatPin(meId, id)); };

  // chat-row menus
  const [menuFor, setMenuFor] = useState<ConversationSummary | null>(null);
  const [reportFor, setReportFor] = useState<ConversationSummary | null>(null);
  const [deleteFor, setDeleteFor] = useState<ConversationSummary | null>(null);
  const [deleteEveryone, setDeleteEveryone] = useState(false);

  const refetch = () => void fetchConversations(sb, meId).then(setConversations).catch(() => {});

  // keep the inbox fresh: refetch on any conversation/message change for me
  useEffect(() => {
    const ch = sb
      .channel(`inbox:${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refetch)
      .subscribe();
    return () => { void sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId, sb]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = !term
      ? conversations
      : conversations.filter(
          (c) => c.peer.fullName.toLowerCase().includes(term) || c.peer.username.toLowerCase().includes(term),
        );
    // pinned chats float to the top (stable sort keeps recency otherwise)
    const pinnedSet = new Set(pinned);
    return [...list].sort((a, b) => (pinnedSet.has(b.id) ? 1 : 0) - (pinnedSet.has(a.id) ? 1 : 0));
  }, [conversations, q, pinned]);

  const doBlock = async (c: ConversationSummary) => {
    setMenuFor(null);
    try {
      await blockUser(sb, meId, c.peer.id);
      toast.success(`Blocked ${c.peer.fullName || "@" + c.peer.username}`);
    } catch {
      toast.error("Couldn’t block");
    }
  };

  const confirmDelete = async () => {
    const c = deleteFor;
    if (!c) return;
    const everyone = deleteEveryone;
    setDeleteFor(null);
    setDeleteEveryone(false);
    setConversations((prev) => prev.filter((x) => x.id !== c.id)); // optimistic
    try {
      if (everyone) await deleteConversation(sb, c.id);
      else await clearConversationForMe(sb, c.id, meId);
    } catch {
      toast.error("Couldn’t delete chat");
      refetch();
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* thread list — its own scroll, nothing else */}
      <aside
        className={cn(
          "flex min-h-0 w-full flex-col border-r border-[var(--panel-border)] bg-bg-elev/40 lg:w-[340px] lg:shrink-0",
          activePeerId && "hidden lg:flex",
        )}
      >
        <div className="shrink-0 border-b border-[var(--panel-border)] px-4 py-3.5">
          <h1 className="mb-3 text-xl font-black">Messages</h1>
          <div className="field flex items-center gap-2 rounded-xl px-3 py-2">
            <Search className="h-4 w-4 text-fg-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search conversations"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-fg-muted">
              {conversations.length === 0 ? "No conversations yet. Message a seller from any product." : "No matches."}
            </p>
          ) : (
            filtered.map((c) => {
              const active = c.peer.id === activePeerId;
              const fromMe = c.lastSender === meId;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group relative border-b border-[var(--panel-border)] transition",
                    active ? "bg-[var(--panel)]" : "hover:bg-[var(--panel)]",
                  )}
                >
                  <Link href={`/messages/${c.peer.id}`} className="flex items-center gap-3 px-4 py-3 pr-11">
                    <Avatar src={c.peer.avatarUrl} name={c.peer.username} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{c.peer.fullName || `@${c.peer.username}`}</span>
                        {c.peer.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                        {pinned.includes(c.id) && <Pin className="ml-auto h-3 w-3 shrink-0 rotate-45 text-accent" />}
                        <span className={cn("shrink-0 font-mono text-[10px] text-fg-muted", !pinned.includes(c.id) && "ml-auto")}>
                          {formatDistanceToNow(new Date(c.lastAt), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs text-fg-muted">
                          {fromMe && "You: "}{c.lastMessage || "New conversation"}
                        </p>
                        {c.unread > 0 && (
                          <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-on-accent">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setMenuFor(c)}
                    aria-label="Chat options"
                    className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-fg-muted opacity-100 transition hover:bg-bg-elev hover:text-accent lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* active chat / splash — fills the rest, ChatPane owns its own scroll */}
      <section className={cn("min-h-0 min-w-0 flex-1", !activePeerId && "hidden lg:block")}>
        {activePeerId ? (
          <ChatPane key={activePeerId} meId={meId} peerId={activePeerId} peer={activePeer} />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
                <MessageSquare className="h-7 w-7" />
              </div>
              <p className="mt-4 text-lg font-bold">Your messages</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-fg-muted">
                Pick a conversation, or message a seller from any product page to start chatting.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* per-chat options — a little "bubble" telling you whose chat this is */}
      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <>
            <div className="mb-3 flex flex-col items-center gap-2 px-2 pt-1">
              <Avatar src={menuFor.peer.avatarUrl} name={menuFor.peer.username} size={54} />
              <div className="relative max-w-[80%] rounded-2xl rounded-bl-md bg-[var(--panel)] px-4 py-2 text-center">
                <p className="truncate text-sm font-bold">{menuFor.peer.fullName || `@${menuFor.peer.username}`}</p>
                <p className="truncate text-xs text-fg-muted">@{menuFor.peer.username}</p>
              </div>
            </div>
            <div className="mb-1 h-px bg-[var(--panel-border)]" />
            <SheetItem
              icon={isChatPinned(meId, menuFor.id) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              label={isChatPinned(meId, menuFor.id) ? "Unpin chat" : "Pin chat"}
              onClick={() => { togglePin(menuFor.id); setMenuFor(null); }}
            />
            <SheetItem
              icon={<UserRound className="h-4 w-4" />}
              label="View profile"
              onClick={() => { window.location.href = `/profile/${menuFor.peer.id}`; }}
            />
            <SheetItem
              icon={<Ban className="h-4 w-4" />}
              label="Block user"
              onClick={() => void doBlock(menuFor)}
            />
            <SheetItem
              icon={<Flag className="h-4 w-4" />}
              label="Report"
              onClick={() => { setReportFor(menuFor); setMenuFor(null); }}
            />
            <SheetItem
              icon={<Trash2 className="h-4 w-4" />}
              label="Delete chat"
              danger
              onClick={() => { setDeleteFor(menuFor); setMenuFor(null); }}
            />
          </>
        )}
      </Sheet>

      {/* delete confirmation with "for everyone" toggle */}
      <Modal open={!!deleteFor} onClose={() => { setDeleteFor(null); setDeleteEveryone(false); }}>
        {deleteFor && (
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight">Delete chat</h3>
                <p className="truncate text-xs text-fg-muted">with {deleteFor.peer.fullName || `@${deleteFor.peer.username}`}</p>
              </div>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--panel-border)] px-3 py-3 transition hover:bg-[var(--panel)]">
              <input
                type="checkbox"
                checked={deleteEveryone}
                onChange={(e) => setDeleteEveryone(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-sm">
                <span className="font-medium">Also delete for everyone</span>
                <span className="block text-xs text-fg-muted">Removes the whole conversation for both of you.</span>
              </span>
            </label>
            <p className="mt-2 text-xs text-fg-muted">
              {deleteEveryone
                ? "The chat and all its messages will be permanently removed for both people."
                : "The chat is hidden from your list. It comes back if they message you again."}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => { setDeleteFor(null); setDeleteEveryone(false); }}
                className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                className="flex-1 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {reportFor && (
        <ReportModal
          open
          onClose={() => setReportFor(null)}
          meId={meId}
          peer={reportFor.peer}
          conversationId={reportFor.id}
        />
      )}
    </div>
  );
}
