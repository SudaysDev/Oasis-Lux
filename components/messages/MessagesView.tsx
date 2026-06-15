"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Search } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchConversations, type ConversationSummary } from "@/lib/data/messages";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";
import { VerifiedBadge } from "@/components/profile/Badges";
import { ChatPane } from "@/components/messages/ChatPane";
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

  // keep the inbox fresh: refetch on any conversation/message change for me
  useEffect(() => {
    const refetch = () => void fetchConversations(sb, meId).then(setConversations).catch(() => {});
    const ch = sb
      .channel(`inbox:${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refetch)
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [meId, sb]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter(
      (c) => c.peer.fullName.toLowerCase().includes(term) || c.peer.username.toLowerCase().includes(term),
    );
  }, [conversations, q]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-5 text-3xl font-black sm:text-4xl">Messages</h1>

      <div className="grid h-[calc(100dvh-12rem)] overflow-hidden rounded-3xl border border-[var(--panel-border)] lg:grid-cols-[330px_1fr]">
        {/* thread list */}
        <div className={cn("flex min-h-0 flex-col border-r border-[var(--panel-border)] bg-bg-elev/40", activePeerId && "hidden lg:flex")}>
          <div className="border-b border-[var(--panel-border)] p-3">
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

          <div className="no-scrollbar flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-fg-muted">
                {conversations.length === 0 ? "No conversations yet. Message a seller from any product." : "No matches."}
              </p>
            ) : (
              filtered.map((c) => {
                const active = c.peer.id === activePeerId;
                const fromMe = c.lastSender === meId;
                return (
                  <Link
                    key={c.id}
                    href={`/messages/${c.peer.id}`}
                    className={cn(
                      "flex items-center gap-3 border-b border-[var(--panel-border)] px-4 py-3 transition hover:bg-[var(--panel)]",
                      active && "bg-[var(--panel)]",
                    )}
                  >
                    <Avatar src={c.peer.avatarUrl} name={c.peer.username} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{c.peer.fullName || `@${c.peer.username}`}</span>
                        {c.peer.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-fg-muted">
                          {formatDistanceToNow(new Date(c.lastAt), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs text-fg-muted">
                          {fromMe && "You: "}{c.lastMessage || "New conversation"}
                        </p>
                        {c.unread > 0 && (
                          <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-black">
                            {c.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* active chat / splash */}
        <div className={cn("min-h-0", !activePeerId && "hidden lg:block")}>
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
        </div>
      </div>
    </div>
  );
}
