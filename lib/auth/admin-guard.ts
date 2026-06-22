import "server-only";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOwnerEmail } from "./admin-accounts";

type SB = ReturnType<typeof createAdminClient>;

async function emailOf(sb: SB, id: string): Promise<string | null> {
  const { data } = await sb.from("profiles").select("email").eq("id", id).maybeSingle();
  return (data?.email as string | undefined) ?? null;
}

/** True when the CURRENT operator is the owner (creator) — the top of the hierarchy. */
export async function isOwnerActor(sb: SB): Promise<boolean> {
  const me = await getCurrentProfile();
  if (!me || me.role !== "admin") return false;
  return isOwnerEmail(await emailOf(sb, me.id));
}

/**
 * Hierarchy guard for moderating a *user* by id.
 * Returns a refusal string, or `null` when the current operator IS allowed to act.
 *   • normal users          → always allowed
 *   • the owner (creator)    → untouchable by everyone (incl. himself)
 *   • another admin (Waxa)   → only the owner may moderate them
 */
export async function guardModerateUser(sb: SB, targetId: string): Promise<string | null> {
  const { data } = await sb.from("profiles").select("role,email").eq("id", targetId).maybeSingle();
  if ((data?.role as string | undefined) !== "admin") return null;
  const targetEmail = (data?.email as string | undefined) ?? null;
  if (isOwnerEmail(targetEmail)) return "The owner account is protected — it can’t be moderated.";
  return (await isOwnerActor(sb))
    ? null
    : "This admin can only be moderated by the owner.";
}
