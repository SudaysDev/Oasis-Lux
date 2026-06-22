"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return createAdminClient();
}

const TYPES = new Set(["percent", "fixed", "cashback"]);
const SCOPES = new Set(["all", "category", "product", "brand"]);

export interface PromoInput {
  code: string; type: string; value: number; scope: string;
  scopeRef?: string | null; scopeLabel?: string | null;
  minOrder?: number | null; maxDiscount?: number | null;
  expiresAt?: string | null; usageLimit?: number | null; isActive?: boolean;
}

function validate(i: PromoInput): string | null {
  if (!i.code.trim()) return "Code is required.";
  if (!TYPES.has(i.type)) return "Invalid type.";
  if (!SCOPES.has(i.scope)) return "Invalid scope.";
  if (i.value == null || i.value < 0) return "Value can't be negative.";
  if (i.type === "percent" && i.value > 100) return "Percent can't exceed 100.";
  if (i.scope !== "all" && !i.scopeRef?.trim()) return "Pick what the scope targets.";
  return null;
}

export async function createPromo(i: PromoInput): Promise<ActionResult> {
  try {
    const sb = await admin();
    const err = validate(i);
    if (err) return { ok: false, error: err };
    const code = i.code.trim().toUpperCase();
    const { data: clash } = await sb.from("promo_codes").select("id").ilike("code", code).maybeSingle();
    if (clash) return { ok: false, error: "That code already exists." };
    const { data, error } = await sb.from("promo_codes").insert({
      code, type: i.type, value: i.value, scope: i.scope,
      scope_ref: i.scope === "all" ? null : (i.scopeRef ?? null), scope_label: i.scopeLabel?.trim() || null,
      min_order: i.minOrder ?? null, max_discount: i.maxDiscount ?? null,
      expires_at: i.expiresAt || null, usage_limit: i.usageLimit ?? null, is_active: i.isActive ?? true,
    }).select("id").single();
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/promo");
    return { ok: true, id: String(data.id) };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export type PromoPatch = Partial<{
  type: string; value: number; scope: string; scope_ref: string | null; scope_label: string | null;
  min_order: number | null; max_discount: number | null; expires_at: string | null; usage_limit: number | null; is_active: boolean;
}>;
const ALLOWED = new Set(["type", "value", "scope", "scope_ref", "scope_label", "min_order", "max_discount", "expires_at", "usage_limit", "is_active"]);

export async function updatePromo(id: string, patch: PromoPatch): Promise<ActionResult> {
  try {
    const sb = await admin();
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (ALLOWED.has(k)) clean[k] = v;
    if (typeof clean.value === "number" && clean.value < 0) return { ok: false, error: "Value can't be negative." };
    if (typeof clean.type === "string" && !TYPES.has(clean.type)) return { ok: false, error: "Invalid type." };
    if (typeof clean.scope === "string" && !SCOPES.has(clean.scope)) return { ok: false, error: "Invalid scope." };
    if (Object.keys(clean).length === 0) return { ok: false, error: "Nothing to update." };
    const { error } = await sb.from("promo_codes").update(clean).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/promo/${id}`);
    revalidatePath("/admin/promo");
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function togglePromo(id: string, active: boolean): Promise<ActionResult> {
  return updatePromo(id, { is_active: active });
}

export async function resetPromoUsage(id: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("promo_codes").update({ used_count: 0 }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/promo/${id}`);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function deletePromo(id: string): Promise<void> {
  const sb = await admin();
  await sb.from("promo_codes").delete().eq("id", id);
  revalidatePath("/admin/promo");
  redirect("/admin/promo");
}
