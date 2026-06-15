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
}

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
}
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
  };
}

export async function fetchPeerMini(sb: SupabaseClient, peerId: string): Promise<MiniProfile | null> {
  const { data } = await sb.from("profiles").select(MINI).eq("id", peerId).maybeSingle();
  return data ? toMini(data as RawMini) : null;
}

/** All conversations for the inbox, newest activity first, with unread counts. */
export async function fetchConversations(sb: SupabaseClient, meId: string): Promise<ConversationSummary[]> {
  const { data } = await sb
    .from("conversations")
    .select(
      `id, user_a, user_b, last_message, last_sender, last_at, a:profiles!conversations_user_a_fkey(${MINI}), b:profiles!conversations_user_b_fkey(${MINI})`,
    )
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)
    .order("last_at", { ascending: false });

  interface Row {
    id: string; user_a: string; user_b: string; last_message: string; last_sender: string | null; last_at: string;
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

  return rows.map((r) => {
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

export async function fetchMessages(sb: SupabaseClient, conversationId: string): Promise<ChatMessage[]> {
  const { data } = await sb
    .from("messages")
    .select("id, conversation_id, sender_id, recipient_id, text, attachments, read, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as MsgRow[]).map(mapMessage);
}

export async function sendMessage(
  sb: SupabaseClient,
  conversationId: string,
  senderId: string,
  recipientId: string,
  text: string,
  attachments: string[] = [],
): Promise<ChatMessage | null> {
  const { data, error } = await sb
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, recipient_id: recipientId, text, attachments })
    .select("id, conversation_id, sender_id, recipient_id, text, attachments, read, created_at")
    .single();
  if (error) throw error;
  return data ? mapMessage(data as MsgRow) : null;
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
