"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; url?: string } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return createAdminClient();
}

export type ProductPatch = Partial<{
  title: string; brand: string; description: string; color: string | null; condition: string;
  category: string | null; type: string; price: number; stock: number; is_active: boolean; tags: string[]; hue: number;
}>;

const ALLOWED = new Set(["title", "brand", "description", "color", "condition", "category", "type", "price", "stock", "is_active", "tags", "hue"]);

export async function adminUpdateProduct(id: string, patch: ProductPatch): Promise<ActionResult> {
  try {
    const sb = await admin();
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (ALLOWED.has(k)) clean[k] = v;
    if (typeof clean.price === "number" && clean.price < 0) return { ok: false, error: "Price can't be negative." };
    if (typeof clean.stock === "number" && clean.stock < 0) return { ok: false, error: "Stock can't be negative." };
    if (Object.keys(clean).length === 0) return { ok: false, error: "Nothing to update." };
    const { error } = await sb.from("products").update(clean).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/products/${id}`);
    revalidatePath("/admin/products");
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}

export async function adminToggleProduct(id: string, active: boolean): Promise<ActionResult> {
  return adminUpdateProduct(id, { is_active: active });
}

// Product sanctions live in products.sanctions jsonb — timed like user restrictions.
export type ProductFlag = "hidden" | "frozen" | "no_reviews" | "no_orders" | "featured";
const PRODUCT_FLAGS = new Set<ProductFlag>(["hidden", "frozen", "no_reviews", "no_orders", "featured"]);

export async function adminSetProductFlag(id: string, flag: ProductFlag, value: boolean, durationMs?: number): Promise<ActionResult> {
  try {
    const sb = await admin();
    if (!PRODUCT_FLAGS.has(flag)) return { ok: false, error: "Unknown flag." };
    const { data } = await sb.from("products").select("sanctions").eq("id", id).maybeSingle();
    const map = { ...((data?.sanctions ?? {}) as Record<string, string>) };
    if (!value) delete map[flag];
    else map[flag] = durationMs && durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : "perm";
    const { error } = await sb.from("products").update({ sanctions: map }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/products/${id}`);
    revalidatePath("/admin/products");
    return { ok: true };
  } catch { return { ok: false, error: "Not allowed." }; }
}

export async function adminSetProductImages(id: string, images: string[]): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("products").update({ images }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/products/${id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}

export async function adminUploadProductImage(id: string, formData: FormData): Promise<ActionResult> {
  try {
    const sb = await admin();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file." };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Image too large (max 8MB)." };
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `admin/products/${id}-${Date.now()}.${ext}`;
    const buf = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await sb.storage.from("media").upload(path, buf, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) return { ok: false, error: upErr.message };
    const { data: pub } = sb.storage.from("media").getPublicUrl(path);
    const { data: prod } = await sb.from("products").select("images").eq("id", id).maybeSingle();
    const images = [...(((prod?.images ?? []) as string[])), pub.publicUrl];
    const { error } = await sb.from("products").update({ images }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/admin/products/${id}`);
    return { ok: true, url: pub.publicUrl };
  } catch {
    return { ok: false, error: "Upload failed." };
  }
}

export async function adminDeleteProduct(id: string): Promise<void> {
  const sb = await admin();
  await sb.from("products").delete().eq("id", id);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
