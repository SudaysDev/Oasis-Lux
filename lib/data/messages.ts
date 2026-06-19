// Messaging data layer (browser): conversations inbox + 1-on-1 chat.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniProfile, Plan } from "@/types";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  text: string;
  attachments: string[];
  read: boolean;
  createdAt: string;
  replyTo: string | null;
  /** original author when this message was forwarded (null = not a forward) */
  forwardedFrom: string | null;
  /** 'normal' chat message, or 'service' action chip (pinned / cleared / …) */
  kind: "normal" | "service";
}

/** messageId -> emoji -> list of user ids who reacted with it. */
export type ReactionMap = Record<string, Record<string, string[]>>;

export interface ConversationSummary {
  id: string;
  peer: MiniProfile;
  lastMessage: string;
  lastSender: string | null;
  lastAt: string;
  unread: number;
}

interface RawMini {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: Plan | null;
  is_verified: boolean | null;
}
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const toMini = (r: RawMini | null): MiniProfile => ({
  id: r?.id ?? "",
  username: r?.username ?? "unknown",
  fullName: r?.full_name ?? "",
  avatarUrl: r?.avatar_url ?? undefined,
  plan: r?.plan ?? "free",
  isVerified: r?.is_verified ?? false,
});

const MINI = "id, username, full_name, avatar_url, plan, is_verified";

/** Canonical pair (a < b) so a buyer↔seller chat dedupes regardless of who opens it. */
function pair(x: string, y: string): { a: string; b: string } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

interface MsgRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  text: string;
  attachments: string[] | null;
  read: boolean;
  created_at: string;
  reply_to: string | null;
  forwarded_from: string | null;
  kind: string | null;
}
const MSG_COLS = "id, conversation_id, sender_id, recipient_id, text, attachments, read, created_at, reply_to, forwarded_from, kind";
export function mapMessage(r: MsgRow): ChatMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    text: r.text,
    attachments: r.attachments ?? [],
    read: r.read,
    createdAt: r.created_at,
    replyTo: r.reply_to ?? null,
    forwardedFrom: r.forwarded_from ?? null,
    kind: r.kind === "service" ? "service" : "normal",
  };
}

export async function fetchPeerMini(sb: SupabaseClient, peerId: string): Promise<MiniProfile | null> {
  const { data } = await sb.from("profiles").select(MINI).eq("id", peerId).maybeSingle();
  return data ? toMini(data as RawMini) : null;
}

/** All conversations for the inbox, newest activity first, with unread counts.
    Conversations the user "deleted for me" stay hidden until newer activity. */
export async function fetchConversations(sb: SupabaseClient, meId: string): Promise<ConversationSummary[]> {
  const { data } = await sb
    .from("conversations")
    .select(
      `id, user_a, user_b, last_message, last_sender, last_at, a_cleared_at, b_cleared_at, a:profiles!conversations_user_a_fkey(${MINI}), b:profiles!conversations_user_b_fkey(${MINI})`,
    )
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)
    .order("last_at", { ascending: false });

  interface Row {
    id: string; user_a: string; user_b: string; last_message: string; last_sender: string | null; last_at: string;
    a_cleared_at: string | null; b_cleared_at: string | null;
    a: RawMini | RawMini[] | null; b: RawMini | RawMini[] | null;
  }
  const rows = (data ?? []) as unknown as Row[];

  // unread counts (messages addressed to me, still unread), grouped client-side
  const { data: unreadRows } = await sb
    .from("messages")
    .select("conversation_id")
    .eq("recipient_id", meId)
    .eq("read", false);
  const unread = new Map<string, number>();
  for (const u of (unreadRows ?? []) as { conversation_id: string }[]) {
    unread.set(u.conversation_id, (unread.get(u.conversation_id) ?? 0) + 1);
  }

  return rows
    .filter((r) => {
      const cleared = r.user_a === meId ? r.a_cleared_at : r.b_cleared_at;
      // hidden while there's been no new activity since I cleared it ("delete for
      // me"). "Clear history" bumps last_at == cleared so the chat stays visible.
      return !(cleared && new Date(r.last_at).getTime() < new Date(cleared).getTime());
    })
    .map((r) => {
      const a = toMini(one(r.a));
      const b = toMini(one(r.b));
      const peer = a.id === meId ? b : a;
      return {
        id: r.id,
        peer,
        lastMessage: r.last_message,
        lastSender: r.last_sender,
        lastAt: r.last_at,
        unread: unread.get(r.id) ?? 0,
      };
    });
}

/** The timestamp I last "cleared" this conversation at (null if never). */
export async function fetchMyClearedAt(sb: SupabaseClient, convId: string, meId: string): Promise<string | null> {
  const { data } = await sb
    .from("conversations")
    .select("user_a, a_cleared_at, b_cleared_at")
    .eq("id", convId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { user_a: string; a_cleared_at: string | null; b_cleared_at: string | null };
  return row.user_a === meId ? row.a_cleared_at : row.b_cleared_at;
}

/** "Delete for me": hide history + the conversation until the peer writes again. */
export async function clearConversationForMe(sb: SupabaseClient, convId: string, meId: string): Promise<void> {
  const now = new Date().toISOString();
  await sb.from("conversations").update({ a_cleared_at: now }).eq("id", convId).eq("user_a", meId);
  await sb.from("conversations").update({ b_cleared_at: now }).eq("id", convId).eq("user_b", meId);
}

/** "Clear history": empties the thread for me but KEEPS the chat in the inbox
    (Telegram-style). Touches last_at to now so the inbox filter still shows it. */
export async function clearHistoryForMe(sb: SupabaseClient, convId: string, meId: string): Promise<void> {
  const now = new Date().toISOString();
  await sb.from("conversations").update({ a_cleared_at: now }).eq("id", convId).eq("user_a", meId);
  await sb.from("conversations").update({ b_cleared_at: now }).eq("id", convId).eq("user_b", meId);
  await sb.from("conversations").update({ last_message: "", last_sender: null, last_at: now }).eq("id", convId);
}

/** "Delete for everyone": drop the conversation (messages + reactions cascade). */
export async function deleteConversation(sb: SupabaseClient, convId: string): Promise<void> {
  await sb.from("conversations").delete().eq("id", convId);
}

/** Find (or create) the conversation between me and a peer. Returns the id. */
export async function getOrCreateConversation(
  sb: SupabaseClient,
  meId: string,
  peerId: string,
  productId?: string,
): Promise<string> {
  const { a, b } = pair(meId, peerId);
  const existing = await sb.from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
  if (existing.data) return (existing.data as { id: string }).id;

  const { data, error } = await sb
    .from("conversations")
    .insert({ user_a: a, user_b: b, product_id: productId ?? null })
    .select("id")
    .single();
  if (error) {
    // race: someone created it between our select & insert — read it back
    const retry = await sb.from("conversations").select("id").eq("user_a", a).eq("user_b", b).maybeSingle();
    if (retry.data) return (retry.data as { id: string }).id;
    throw error;
  }
  return (data as { id: string }).id;
}

export async function fetchMessages(
  sb: SupabaseClient,
  conversationId: string,
  since?: string | null,
): Promise<ChatMessage[]> {
  let query = sb.from("messages").select(MSG_COLS).eq("conversation_id", conversationId);
  if (since) query = query.gt("created_at", since); // hide history cleared "for me"
  const { data } = await query.order("created_at", { ascending: true });
  return ((data ?? []) as MsgRow[]).map(mapMessage);
}

export async function sendMessage(
  sb: SupabaseClient,
  conversationId: string,
  senderId: string,
  recipientId: string,
  text: string,
  attachments: string[] = [],
  replyTo: string | null = null,
  forwardedFrom: string | null = null,
): Promise<ChatMessage | null> {
  const { data, error } = await sb
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, recipient_id: recipientId, text, attachments, reply_to: replyTo, forwarded_from: forwardedFrom })
    .select(MSG_COLS)
    .single();
  if (error) throw error;
  return data ? mapMessage(data as MsgRow) : null;
}

/** Unsend (delete) one of my own messages. */
export async function deleteMessage(sb: SupabaseClient, id: string): Promise<void> {
  await sb.from("messages").delete().eq("id", id);
}

// ---------------------------------------------------------------------------
// Pinned messages + service ("action") messages
// ---------------------------------------------------------------------------

/** Post a centered action chip into the timeline ("<name> pinned a message"). */
export async function postServiceMessage(
  sb: SupabaseClient,
  conversationId: string,
  senderId: string,
  recipientId: string,
  text: string,
): Promise<ChatMessage | null> {
  const { data, error } = await sb
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, recipient_id: recipientId, text, kind: "service", read: true })
    .select(MSG_COLS)
    .single();
  if (error) throw error;
  return data ? mapMessage(data as MsgRow) : null;
}

/** All pinned message ids for a conversation, in pin order. */
export async function fetchPinnedMessageIds(sb: SupabaseClient, conversationId: string): Promise<string[]> {
  const { data } = await sb.from("conversations").select("pinned_message_ids").eq("id", conversationId).maybeSingle();
  return (data as { pinned_message_ids: string[] | null } | null)?.pinned_message_ids ?? [];
}

/** Pin a message (append to the list) + drop a "<name> pinned a message" chip. */
export async function pinMessage(
  sb: SupabaseClient,
  args: { conversationId: string; messageId: string; meId: string; recipientId: string; byName: string },
): Promise<ChatMessage | null> {
  const cur = await fetchPinnedMessageIds(sb, args.conversationId);
  if (!cur.includes(args.messageId)) {
    const { error } = await sb.from("conversations").update({ pinned_message_ids: [...cur, args.messageId] }).eq("id", args.conversationId);
    if (error) throw error;
  }
  return postServiceMessage(sb, args.conversationId, args.meId, args.recipientId, `${args.byName} pinned a message`);
}

/** Unpin one message, or all when `messageId` is omitted. */
export async function unpinMessage(sb: SupabaseClient, conversationId: string, messageId?: string): Promise<void> {
  const cur = await fetchPinnedMessageIds(sb, conversationId);
  const next = messageId ? cur.filter((id) => id !== messageId) : [];
  const { error } = await sb.from("conversations").update({ pinned_message_ids: next }).eq("id", conversationId);
  if (error) throw error;
}

/** Mark every message addressed to me in this conversation as read. */
export async function markRead(sb: SupabaseClient, conversationId: string, meId: string): Promise<void> {
  await sb
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", conversationId)
    .eq("recipient_id", meId)
    .eq("read", false);
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------
interface ReactionRow { message_id: string; emoji: string; user_id: string }

export async function fetchReactions(sb: SupabaseClient, conversationId: string): Promise<ReactionMap> {
  const { data } = await sb
    .from("message_reactions")
    .select("message_id, emoji, user_id")
    .eq("conversation_id", conversationId);
  const map: ReactionMap = {};
  for (const r of (data ?? []) as ReactionRow[]) {
    ((map[r.message_id] ??= {})[r.emoji] ??= []).push(r.user_id);
  }
  return map;
}

export async function addReaction(
  sb: SupabaseClient,
  args: { messageId: string; conversationId: string; userId: string; emoji: string },
): Promise<void> {
  await sb.from("message_reactions").insert({
    message_id: args.messageId,
    conversation_id: args.conversationId,
    user_id: args.userId,
    emoji: args.emoji,
  });
}

export async function removeReaction(
  sb: SupabaseClient,
  args: { messageId: string; userId: string; emoji: string },
): Promise<void> {
  await sb
    .from("message_reactions")
    .delete()
    .eq("message_id", args.messageId)
    .eq("user_id", args.userId)
    .eq("emoji", args.emoji);
}

/** One reaction per user per message (Telegram-style): drop my existing reaction
    on this message, then set the new emoji. */
export async function setMyReaction(
  sb: SupabaseClient,
  args: { messageId: string; conversationId: string; userId: string; emoji: string },
): Promise<void> {
  await sb.from("message_reactions").delete().eq("message_id", args.messageId).eq("user_id", args.userId);
  await sb.from("message_reactions").insert({
    message_id: args.messageId,
    conversation_id: args.conversationId,
    user_id: args.userId,
    emoji: args.emoji,
  });
}

/** Remove whatever reaction I have on this message. */
export async function clearMyReaction(sb: SupabaseClient, messageId: string, userId: string): Promise<void> {
  await sb.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId);
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------
export interface BlockState { iBlocked: boolean; blockedMe: boolean }

export async function fetchBlockState(sb: SupabaseClient, meId: string, peerId: string): Promise<BlockState> {
  const { data } = await sb
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${meId},blocked_id.eq.${peerId}),and(blocker_id.eq.${peerId},blocked_id.eq.${meId})`,
    );
  const rows = (data ?? []) as { blocker_id: string; blocked_id: string }[];
  return {
    iBlocked: rows.some((r) => r.blocker_id === meId),
    blockedMe: rows.some((r) => r.blocker_id === peerId),
  };
}

export async function blockUser(sb: SupabaseClient, meId: string, peerId: string): Promise<void> {
  await sb
    .from("blocks")
    .upsert({ blocker_id: meId, blocked_id: peerId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
}

export async function unblockUser(sb: SupabaseClient, meId: string, peerId: string): Promise<void> {
  await sb.from("blocks").delete().eq("blocker_id", meId).eq("blocked_id", peerId);
}
