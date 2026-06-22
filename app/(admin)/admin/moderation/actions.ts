"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardModerateUser } from "@/lib/auth/admin-guard";
import { decidePunishment, type ModDecision, type ModSubject, type ViolationCategory } from "@/lib/moderation/policy";

export type FileViolationResult = { ok: true; decision: ModDecision } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return { sb: createAdminClient(), adminId: profile.id };
}

export interface ViolationInput {
  subjectType: ModSubject;
  subjectId: string;
  category: ViolationCategory;
  severity: number;       // 1..5
  detail?: string;
  evidence?: string;
}

/**
 * Log a violation and let the auto-moderation engine hand down + APPLY the
 * punishment (mute / ban / hide / delete), escalating on repeat offences.
 */
export async function adminFileViolation(input: ViolationInput): Promise<FileViolationResult> {
  try {
    const { sb, adminId } = await admin();

    // resolve the offending user (for a product → its seller) + protect admins
    let offenderId: string | null = null;
    let productTitle = "";
    if (input.subjectType === "user") {
      const { data } = await sb.from("profiles").select("role").eq("id", input.subjectId).maybeSingle();
      if (!data) return { ok: false, error: "User not found." };
      const guard = await guardModerateUser(sb, input.subjectId);
      if (guard) return { ok: false, error: guard };
      offenderId = input.subjectId;
    } else {
      const { data } = await sb.from("products").select("seller_id,title").eq("id", input.subjectId).maybeSingle();
      if (!data) return { ok: false, error: "Product not found." };
      offenderId = data.seller_id ?? null;
      productTitle = data.title ?? "";
      if (offenderId) {
        const { data: seller } = await sb.from("profiles").select("role").eq("id", offenderId).maybeSingle();
        if (seller?.role === "admin") offenderId = null; // never sanction an admin seller (still hide/delete the product)
      }
    }

    // prior offences by this offender → drives escalation
    let priorCount = 0;
    if (offenderId) {
      const { count } = await sb.from("violations").select("*", { count: "exact", head: true }).eq("user_id", offenderId);
      priorCount = count ?? 0;
    }

    const severity = Math.max(1, Math.min(5, Math.round(input.severity || 2)));
    const decision = decidePunishment({ subject: input.subjectType, category: input.category, severity, priorCount });
    const now = Date.now();
    const until = decision.durationMs != null ? new Date(now + decision.durationMs).toISOString() : null;

    // ---- apply the punishment -------------------------------------------------
    const reason = `Auto-moderation: ${input.category}${input.detail ? ` — ${input.detail}` : ""}`;
    const setRestriction = async (kind: string) => {
      if (!offenderId) return;
      const { data } = await sb.from("profiles").select("restrictions").eq("id", offenderId).maybeSingle();
      const map = { ...((data?.restrictions ?? {}) as Record<string, string>) };
      map[kind] = until ?? "perm";
      await sb.from("profiles").update({ restrictions: map }).eq("id", offenderId);
    };

    switch (decision.action) {
      case "warn":
        break;
      case "mute_chat": await setRestriction("chat"); break;
      case "mute_review": await setRestriction("review"); break;
      case "block_sell": await setRestriction("sell"); break;
      case "ban":
        if (offenderId) await sb.from("profiles").update({
          is_banned: until === null, ban_until: until, banned_at: new Date().toISOString(), ban_reason: reason,
        }).eq("id", offenderId);
        break;
      case "hide_product": {
        const { data } = await sb.from("products").select("sanctions").eq("id", input.subjectId).maybeSingle();
        const map = { ...((data?.sanctions ?? {}) as Record<string, string>) };
        map.hidden = until ?? "perm";
        await sb.from("products").update({ sanctions: map }).eq("id", input.subjectId);
        break;
      }
      case "delete_product":
        await sb.from("products").delete().eq("id", input.subjectId);
        break;
    }

    // ---- record the case ------------------------------------------------------
    await sb.from("violations").insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      user_id: offenderId,
      category: input.category,
      severity,
      detail: (input.detail ?? "").trim(),
      evidence: input.evidence?.trim() || null,
      action: decision.action,
      action_label: decision.label,
      action_until: until,
      source: "admin",
      admin_id: adminId,
    });

    // ---- tell the offender ----------------------------------------------------
    if (offenderId && decision.action !== "delete_product") {
      await sb.from("notifications").insert({
        user_id: offenderId, type: "system", title: "Moderation action",
        body: `${decision.label} — ${input.category} violation${input.subjectType === "product" && productTitle ? ` on "${productTitle}"` : ""}.`,
      });
    }

    revalidatePath(`/admin/users/${offenderId ?? ""}`);
    revalidatePath(`/admin/products/${input.subjectId}`);
    revalidatePath("/admin/users");
    revalidatePath("/admin/products");
    return { ok: true, decision };
  } catch {
    return { ok: false, error: "Couldn't file the violation." };
  }
}

export async function adminDeleteViolation(id: string, revalidateId: string, subjectType: ModSubject): Promise<{ ok: boolean }> {
  try {
    const { sb } = await admin();
    await sb.from("violations").delete().eq("id", id);
    revalidatePath(subjectType === "user" ? `/admin/users/${revalidateId}` : `/admin/products/${revalidateId}`);
    return { ok: true };
  } catch { return { ok: false }; }
}
