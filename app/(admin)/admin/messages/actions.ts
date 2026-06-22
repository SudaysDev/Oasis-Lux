"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return { sb: createAdminClient(), adminId: profile.id };
}
const rev = (convId: string) => { revalidatePath(`/admin/messages/${convId}`); revalidatePath("/admin/messages"); };

export async function adminDeleteMessage(convId: string, messageId: string): Promise<ActionResult> {
  try {
    const { sb } = await admin();
    // unpin if pinned, then delete
    const { data: conv } = await sb.from("conversations").select("pinned_message_ids").eq("id", convId).maybeSingle();
    const pins = ((conv?.pinned_message_ids ?? []) as string[]).filter((p) => p !== messageId);
    await sb.from("conversations").update({ pinned_message_ids: pins }).eq("id", convId);
    const { error } = await sb.from("messages").delete().eq("id", messageId);
    if (error) return { ok: false, error: error.message };
    rev(convId);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function adminEditMessage(convId: string, messageId: string, text: string): Promise<ActionResult> {
  try {
    const { sb } = await admin();
    const { error } = await sb.from("messages").update({ text }).eq("id", messageId);
    if (error) return { ok: false, error: error.message };
    rev(convId);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

type SB = ReturnType<typeof createAdminClient>;

/** Upload a data-URL image to the media bucket; pass through remote (Tenor gif) URLs untouched. */
async function uploadDataUrl(sb: SB, dataUrl: string): Promise<string | null> {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 8 * 1024 * 1024) return null;
  const ext = m[1].split("/")[1].replace(/[^a-z0-9]/g, "") || "png";
  const path = `admin/chat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, bytes, { contentType: m[1], upsert: false });
  if (error) return null;
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

export async function adminSendMessage(convId: string, text: string, attachments: string[] = []): Promise<ActionResult> {
  try {
    const clean = (text ?? "").trim();
    const { sb, adminId } = await admin();
    const urls: string[] = [];
    for (const a of attachments.slice(0, 6)) {
      if (/^https?:/i.test(a)) urls.push(a);            // Tenor GIF / already-hosted url
      else if (a.startsWith("data:")) { const u = await uploadDataUrl(sb, a); if (u) urls.push(u); }
    }
    if (!clean && urls.length === 0) return { ok: false, error: "Empty message." };
    const { data: conv } = await sb.from("conversations").select("user_a,user_b").eq("id", convId).maybeSingle();
    if (!conv) return { ok: false, error: "Conversation not found." };
    // post as the admin's own profile (god-mode); recipient = participant A
    const { error } = await sb.from("messages").insert({
      conversation_id: convId, sender_id: adminId, recipient_id: conv.user_a, text: clean, attachments: urls, kind: "normal",
    });
    if (error) return { ok: false, error: error.message };
    // keep the conversation preview fresh (best-effort)
    await sb.from("conversations").update({ last_message: clean || "📎 attachment", last_at: new Date().toISOString(), last_sender: adminId }).eq("id", convId);
    rev(convId);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function adminTogglePin(convId: string, messageId: string): Promise<ActionResult> {
  try {
    const { sb } = await admin();
    const { data: conv } = await sb.from("conversations").select("pinned_message_ids").eq("id", convId).maybeSingle();
    const cur = (conv?.pinned_message_ids ?? []) as string[];
    const next = cur.includes(messageId) ? cur.filter((p) => p !== messageId) : [...cur, messageId];
    const { error } = await sb.from("conversations").update({ pinned_message_ids: next }).eq("id", convId);
    if (error) return { ok: false, error: error.message };
    rev(convId);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function adminToggleBlock(convId: string): Promise<ActionResult> {
  try {
    const { sb } = await admin();
    const { data: conv } = await sb.from("conversations").select("user_a,user_b").eq("id", convId).maybeSingle();
    if (!conv) return { ok: false, error: "Conversation not found." };
    const { data: existing } = await sb.from("blocks")
      .select("blocker_id,blocked_id")
      .or(`and(blocker_id.eq.${conv.user_a},blocked_id.eq.${conv.user_b}),and(blocker_id.eq.${conv.user_b},blocked_id.eq.${conv.user_a})`);
    if (existing && existing.length > 0) {
      await sb.from("blocks").delete().or(`and(blocker_id.eq.${conv.user_a},blocked_id.eq.${conv.user_b}),and(blocker_id.eq.${conv.user_b},blocked_id.eq.${conv.user_a})`);
    } else {
      await sb.from("blocks").insert([
        { blocker_id: conv.user_a, blocked_id: conv.user_b },
        { blocker_id: conv.user_b, blocked_id: conv.user_a },
      ]);
    }
    rev(convId);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}
