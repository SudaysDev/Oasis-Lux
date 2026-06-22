import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminConvRow = {
  id: string; aId: string; bId: string; a: string; b: string; aAvatar: string | null; bAvatar: string | null;
  lastMessage: string; lastAt: string; count: number; blocked: boolean;
};
export type AdminMsgStats = {
  total: number; messages: number; activeToday: number; active7d: number;
  blockedPairs: number; withMedia: number; avgPerConv: number; busiest: number;
  trend: { label: string; value: number }[];
  topConversations: AdminConvRow[];
};
export type AdminConversations = AdminMsgStats & { conversations: AdminConvRow[] };

const DAY = 86_400_000;
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export async function getAdminConversations(): Promise<AdminConversations> {
  const sb = createAdminClient();
  const [convRes, msgRes, profRes, blockRes] = await Promise.all([
    sb.from("conversations").select("id,user_a,user_b,last_message,last_at").order("last_at", { ascending: false }).limit(1000),
    sb.from("messages").select("conversation_id,created_at,attachments").limit(40000),
    sb.from("profiles").select("id,username,avatar_url").limit(5000),
    sb.from("blocks").select("blocker_id,blocked_id").limit(5000),
  ]);
  const convs = (convRes.data ?? []) as { id: string; user_a: string; user_b: string; last_message: string; last_at: string }[];
  const msgs = (msgRes.data ?? []) as { conversation_id: string; created_at: string; attachments: string[] | null }[];
  const prof = new Map(((profRes.data ?? []) as { id: string; username: string; avatar_url: string | null }[]).map((p) => [p.id, p] as const));
  const blockedSet = new Set(((blockRes.data ?? []) as { blocker_id: string; blocked_id: string }[]).map((b) => pairKey(b.blocker_id, b.blocked_id)));

  const count = new Map<string, number>();
  let withMedia = 0;
  const now = Date.now();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const days: number[] = Array(14).fill(0);
  for (const m of msgs) {
    count.set(m.conversation_id, (count.get(m.conversation_id) ?? 0) + 1);
    if (m.attachments && m.attachments.length) withMedia++;
    const t = new Date(m.created_at).getTime();
    const idx = 13 - Math.floor((startToday.getTime() - new Date(t).setHours(0, 0, 0, 0)) / DAY);
    if (idx >= 0 && idx < 14) days[idx]++;
  }

  const rows: AdminConvRow[] = convs.map((c) => ({
    id: c.id, aId: c.user_a, bId: c.user_b,
    a: prof.get(c.user_a)?.username ?? "unknown", b: prof.get(c.user_b)?.username ?? "unknown",
    aAvatar: prof.get(c.user_a)?.avatar_url ?? null, bAvatar: prof.get(c.user_b)?.avatar_url ?? null,
    lastMessage: c.last_message, lastAt: c.last_at, count: count.get(c.id) ?? 0,
    blocked: blockedSet.has(pairKey(c.user_a, c.user_b)),
  }));

  const activeToday = rows.filter((r) => new Date(r.lastAt).getTime() >= startToday.getTime()).length;
  const active7d = rows.filter((r) => new Date(r.lastAt).getTime() >= now - 7 * DAY).length;
  const busiest = rows.reduce((mx, r) => Math.max(mx, r.count), 0);

  return {
    total: convs.length,
    messages: msgs.length,
    activeToday,
    active7d,
    blockedPairs: rows.filter((r) => r.blocked).length,
    withMedia,
    avgPerConv: convs.length ? Math.round((msgs.length / convs.length) * 10) / 10 : 0,
    busiest,
    trend: days.map((value, i) => ({ label: `${13 - i}d`, value })),
    topConversations: [...rows].sort((a, b) => b.count - a.count).slice(0, 5),
    conversations: rows,
  };
}

export type AdminThreadMsg = { id: string; senderId: string; sender: string; text: string; attachments: string[]; createdAt: string; kind: string; pinned: boolean };
export type AdminThread = {
  id: string; aId: string; bId: string; a: string; b: string; aAvatar: string | null; bAvatar: string | null;
  blocked: boolean; messages: AdminThreadMsg[]; pinnedIds: string[];
};

export async function getAdminThread(id: string): Promise<AdminThread | null> {
  const sb = createAdminClient();
  const { data: conv } = await sb.from("conversations").select("id,user_a,user_b,pinned_message_ids").eq("id", id).maybeSingle();
  if (!conv) return null;

  const [profRes, msgRes, blockRes] = await Promise.all([
    sb.from("profiles").select("id,username,avatar_url").in("id", [conv.user_a, conv.user_b]),
    sb.from("messages").select("id,sender_id,text,attachments,created_at,kind").eq("conversation_id", id).order("created_at", { ascending: true }).limit(3000),
    sb.from("blocks").select("blocker_id,blocked_id").or(`and(blocker_id.eq.${conv.user_a},blocked_id.eq.${conv.user_b}),and(blocker_id.eq.${conv.user_b},blocked_id.eq.${conv.user_a})`),
  ]);
  const prof = new Map(((profRes.data ?? []) as { id: string; username: string; avatar_url: string | null }[]).map((p) => [p.id, p] as const));
  const pinnedIds = (conv.pinned_message_ids ?? []) as string[];
  const pinnedSet = new Set(pinnedIds);
  const messages = ((msgRes.data ?? []) as { id: string; sender_id: string; text: string; attachments: string[]; created_at: string; kind: string }[]).map((m) => ({
    id: m.id, senderId: m.sender_id, sender: prof.get(m.sender_id)?.username ?? "admin", text: m.text, attachments: m.attachments ?? [], createdAt: m.created_at, kind: m.kind, pinned: pinnedSet.has(m.id),
  }));

  return {
    id: conv.id, aId: conv.user_a, bId: conv.user_b,
    a: prof.get(conv.user_a)?.username ?? "unknown", b: prof.get(conv.user_b)?.username ?? "unknown",
    aAvatar: prof.get(conv.user_a)?.avatar_url ?? null, bAvatar: prof.get(conv.user_b)?.avatar_url ?? null,
    blocked: (blockRes.data ?? []).length > 0, messages, pinnedIds,
  };
}
