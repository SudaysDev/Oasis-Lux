"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardModerateUser } from "@/lib/auth/admin-guard";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Gate: only an admin may run these, and they return a service-role client. */
async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return createAdminClient();
}

function revalidate(id: string) {
  revalidatePath(`/admin/users/${id}`);
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// BAN / UNBAN
// ---------------------------------------------------------------------------
/** Permanent ban when `durationMs` omitted; otherwise a timed (auto-expiring) ban. */
export async function adminBanUser(id: string, reason: string, durationMs?: number): Promise<ActionResult> {
  try {
    const sb = await admin();
    const guard = await guardModerateUser(sb, id);
    if (guard) return { ok: false, error: guard };
    const now = new Date();
    const timed = typeof durationMs === "number" && durationMs > 0;
    const until = timed ? new Date(now.getTime() + durationMs).toISOString() : null;
    const { error } = await sb.from("profiles").update({
      is_banned: !timed, ban_until: until, banned_at: now.toISOString(), ban_reason: reason.trim() || null,
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    const when = timed ? ` until ${new Date(until!).toLocaleString("en-GB")}` : "";
    await sb.from("notifications").insert({
      user_id: id, type: "system", title: timed ? "Account temporarily suspended" : "Account suspended",
      body: `${reason.trim() ? `Reason: ${reason.trim()}.` : "Suspended by an administrator."}${when}`,
    });
    revalidate(id);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function adminUnbanUser(id: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("profiles").update({ is_banned: false, ban_until: null, banned_at: null, ban_reason: null }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await sb.from("notifications").insert({
      user_id: id, type: "system", title: "Account reinstated", body: "Your suspension has been lifted. Welcome back.",
    });
    revalidate(id);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

// ---------------------------------------------------------------------------
// RESTRICTIONS (partial sanctions) — stored in profiles.restrictions jsonb.
//   value omitted/0 → permanent ('perm') · durationMs → ISO "until" timestamp.
// ---------------------------------------------------------------------------
export type RestrictKind = "chat" | "sell" | "buy" | "review" | "report" | "favorite" | "cart";
const RESTRICT_KINDS = new Set<RestrictKind>(["chat", "sell", "buy", "review", "report", "favorite", "cart"]);

export async function adminSetRestriction(id: string, kind: RestrictKind, value: boolean, durationMs?: number): Promise<ActionResult> {
  try {
    const sb = await admin();
    const guard = await guardModerateUser(sb, id);
    if (guard) return { ok: false, error: guard };
    if (!RESTRICT_KINDS.has(kind)) return { ok: false, error: "Unknown restriction." };
    const { data } = await sb.from("profiles").select("restrictions").eq("id", id).maybeSingle();
    const map = { ...((data?.restrictions ?? {}) as Record<string, string>) };
    if (!value) delete map[kind];
    else map[kind] = durationMs && durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : "perm";
    const { error } = await sb.from("profiles").update({ restrictions: map }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidate(id);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

// ---------------------------------------------------------------------------
// EDIT PROFILE (full field-level control)
// ---------------------------------------------------------------------------
export type UserPatch = Partial<{
  full_name: string; username: string; bio: string; role: string; plan: string;
  loyalty_tier: string; loyalty_points: number; cashback_balance: number; is_verified: boolean; admin_note: string;
}>;

const ALLOWED = new Set(["full_name", "username", "bio", "role", "plan", "loyalty_tier", "loyalty_points", "cashback_balance", "is_verified", "admin_note"]);
const ROLES = new Set(["customer", "seller", "courier"]);
const PLANS = new Set(["free", "pro", "elite"]);
const TIERS = new Set(["Bronze", "Silver", "Gold", "Platinum"]);

export async function adminUpdateUserProfile(id: string, patch: UserPatch): Promise<ActionResult> {
  try {
    const sb = await admin();
    const guard = await guardModerateUser(sb, id);
    if (guard) return { ok: false, error: guard };
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (ALLOWED.has(k)) clean[k] = v;
    if (typeof clean.role === "string" && !ROLES.has(clean.role)) return { ok: false, error: "Can't promote to admin from here." };
    if (typeof clean.plan === "string" && !PLANS.has(clean.plan)) return { ok: false, error: "Invalid plan." };
    if (typeof clean.loyalty_tier === "string" && !TIERS.has(clean.loyalty_tier)) return { ok: false, error: "Invalid tier." };
    if (typeof clean.loyalty_points === "number" && clean.loyalty_points < 0) return { ok: false, error: "Points can't be negative." };
    if (typeof clean.cashback_balance === "number" && clean.cashback_balance < 0) return { ok: false, error: "Cashback can't be negative." };
    if (typeof clean.username === "string") {
      clean.username = clean.username.trim();
      if (!clean.username) return { ok: false, error: "Username can't be empty." };
    }
    if (Object.keys(clean).length === 0) return { ok: false, error: "Nothing to update." };
    const { error } = await sb.from("profiles").update(clean).eq("id", id);
    if (error) return { ok: false, error: error.message.includes("username") ? "That username is taken." : error.message };
    revalidate(id);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function adminSetUserNote(id: string, note: string): Promise<ActionResult> {
  return adminUpdateUserProfile(id, { admin_note: note });
}

// ---------------------------------------------------------------------------
// DELETE (irreversible — removes the auth user; profile cascades away)
// ---------------------------------------------------------------------------
export async function adminDeleteUser(id: string): Promise<void> {
  const sb = await admin();
  if (await guardModerateUser(sb, id)) throw new Error("forbidden");
  await sb.auth.admin.deleteUser(id);
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
