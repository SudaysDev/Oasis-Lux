"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return createAdminClient();
}

const STATUSES = new Set(["placed", "processing", "out_for_delivery", "arrived", "fulfilled", "cancelled"]);

export async function setOrderStatus(id: string, status: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    if (!STATUSES.has(status)) return { ok: false, error: "Invalid status." };
    const patch: Record<string, unknown> = { status };
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    const { error } = await sb.from("orders").update(patch).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/orders/${id}`);
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function markOrderPaid(id: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("orders").update({ paid_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/orders/${id}`);
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function deleteOrder(id: string): Promise<void> {
  const sb = await admin();
  await sb.from("orders").delete().eq("id", id);
  revalidatePath("/admin/orders");
  redirect("/admin/orders");
}
