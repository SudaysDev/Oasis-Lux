"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminBanUser, adminUnbanUser, adminSetRestriction, type RestrictKind } from "@/app/(admin)/admin/users/[id]/actions";
import { adminSetProductFlag, type ProductFlag } from "@/app/(admin)/admin/products/[id]/actions";
import { guardModerateUser } from "@/lib/auth/admin-guard";

export type ActionResult = { ok: true; msg?: string } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return createAdminClient();
}

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function resolveUser(sb: ReturnType<typeof createAdminClient>, token: string) {
  const t = token.replace(/^@/, "").trim();
  if (!t) return null;
  const q = isUuid(t) ? sb.from("profiles").select("id,username,role").eq("id", t) : sb.from("profiles").select("id,username,role").ilike("username", t);
  const { data } = await q.maybeSingle();
  return (data as { id: string; username: string; role: string } | null) ?? null;
}

const done = () => revalidatePath("/admin/bans");

/* ---------------- BANS ------------------------------------------------ */
export async function liftBan(userId: string): Promise<ActionResult> {
  try { const r = await adminUnbanUser(userId); done(); return r.ok ? { ok: true, msg: "Ban lifted." } : r; }
  catch { return { ok: false, error: "Not allowed." }; }
}

export async function createBan(identifier: string, reason: string, durationMs?: number): Promise<ActionResult> {
  try {
    const sb = await admin();
    const u = await resolveUser(sb, identifier);
    if (!u) return { ok: false, error: `No user matched "${identifier}".` };
    const r = await adminBanUser(u.id, reason, durationMs);
    done();
    return r.ok ? { ok: true, msg: `@${u.username} banned.` } : r;
  } catch { return { ok: false, error: "Not allowed." }; }
}

/* ---------------- RESTRICTIONS ---------------------------------------- */
export async function liftRestriction(userId: string, kind: RestrictKind): Promise<ActionResult> {
  try { const r = await adminSetRestriction(userId, kind, false); done(); return r.ok ? { ok: true, msg: `${kind} restriction lifted.` } : r; }
  catch { return { ok: false, error: "Not allowed." }; }
}

export async function createRestriction(identifier: string, kind: RestrictKind, durationMs?: number): Promise<ActionResult> {
  try {
    const sb = await admin();
    const u = await resolveUser(sb, identifier);
    if (!u) return { ok: false, error: `No user matched "${identifier}".` };
    const r = await adminSetRestriction(u.id, kind, true, durationMs);
    done();
    return r.ok ? { ok: true, msg: `@${u.username} restricted: ${kind}.` } : r;
  } catch { return { ok: false, error: "Not allowed." }; }
}

/* ---------------- PRODUCT SANCTIONS ----------------------------------- */
export async function liftSanction(productId: string, flag: ProductFlag): Promise<ActionResult> {
  try { const r = await adminSetProductFlag(productId, flag, false); done(); return r.ok ? { ok: true, msg: `${flag} lifted.` } : r; }
  catch { return { ok: false, error: "Not allowed." }; }
}

/* ---------------- SCOPED PURCHASE BLOCKS ------------------------------ */
export async function liftPurchaseBlock(blockId: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("purchase_blocks").delete().eq("id", blockId);
    if (error) return { ok: false, error: error.message };
    done();
    return { ok: true, msg: "Purchase block lifted." };
  } catch { return { ok: false, error: "Not allowed." }; }
}

const SCOPES = new Set(["brand", "category", "color", "tag"]);
export async function createPurchaseBlock(identifier: string, scopeType: string, scopeValue: string, durationMs?: number): Promise<ActionResult> {
  try {
    const sb = await admin();
    if (!SCOPES.has(scopeType) || !scopeValue.trim()) return { ok: false, error: "Pick a scope and value." };
    const u = await resolveUser(sb, identifier);
    if (!u) return { ok: false, error: `No user matched "${identifier}".` };
    const guard = await guardModerateUser(sb, u.id);
    if (guard) return { ok: false, error: guard };
    const until = durationMs && durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : null;
    const { error } = await sb.from("purchase_blocks").upsert({ user_id: u.id, scope_type: scopeType, scope_value: scopeValue.trim(), until }, { onConflict: "user_id,scope_type,scope_value" });
    if (error) return { ok: false, error: error.message };
    await sb.from("notifications").insert({ user_id: u.id, type: "system", title: "Purchase restriction", body: `You can no longer buy ${scopeType} “${scopeValue.trim()}”.` });
    done();
    return { ok: true, msg: `@${u.username} blocked from ${scopeType}:${scopeValue.trim()}.` };
  } catch { return { ok: false, error: "Not allowed." }; }
}

/* ---------------- VIOLATIONS / REPORTS -------------------------------- */
export async function deleteViolation(id: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("violations").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    done();
    return { ok: true, msg: "Violation removed." };
  } catch { return { ok: false, error: "Not allowed." }; }
}

const REPORT_STATUS = new Set(["open", "reviewing", "resolved", "dismissed"]);
export async function setReportStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    if (!REPORT_STATUS.has(status)) return { ok: false, error: "Bad status." };
    const { error } = await sb.from("reports").update({ status }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    done();
    return { ok: true, msg: `Report ${status}.` };
  } catch { return { ok: false, error: "Not allowed." }; }
}
