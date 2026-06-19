"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("forbidden");
  return createAdminClient();
}
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const rev = () => revalidatePath("/admin/catalog");

/* ---------------- categories ---------------- */
export async function createCategory(name: string, parentId: string | null, icon = "Tag"): Promise<ActionResult> {
  try {
    const sb = await admin();
    const clean = name.trim();
    if (!clean) return { ok: false, error: "Name is required." };
    let slug = slugify(clean) || `cat-${Date.now()}`;
    const { data: clash } = await sb.from("categories").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
    const { error } = await sb.from("categories").insert({ name: clean, slug, parent_id: parentId, icon, sort: 100 });
    if (error) return { ok: false, error: error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}
export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    if (!name.trim()) return { ok: false, error: "Name is required." };
    const { error } = await sb.from("categories").update({ name: name.trim() }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}

/* ---------------- generic vocab (brands / tags) ---------------- */
async function createVocab(table: "brands" | "tags", name: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const clean = name.trim();
    if (!clean) return { ok: false, error: "Name is required." };
    const { error } = await sb.from(table).insert({ name: clean });
    if (error) return { ok: false, error: /duplicate/i.test(error.message) ? "Already exists." : error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}
async function deleteVocab(table: "brands" | "colors" | "tags", id: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const { error } = await sb.from(table).delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}
export async function createBrand(name: string): Promise<ActionResult> { return createVocab("brands", name); }
export async function deleteBrand(id: string): Promise<ActionResult> { return deleteVocab("brands", id); }
export async function createTag(name: string): Promise<ActionResult> { return createVocab("tags", name); }
export async function deleteTag(id: string): Promise<ActionResult> { return deleteVocab("tags", id); }
export async function deleteColor(id: string): Promise<ActionResult> { return deleteVocab("colors", id); }

/* ---------------- colors ---------------- */
export async function createColor(name: string, hex: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    const clean = name.trim();
    if (!clean) return { ok: false, error: "Name is required." };
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return { ok: false, error: "Invalid hex color." };
    const { error } = await sb.from("colors").insert({ name: clean, hex });
    if (error) return { ok: false, error: /duplicate/i.test(error.message) ? "Already exists." : error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}
export async function updateColor(id: string, hex: string): Promise<ActionResult> {
  try {
    const sb = await admin();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return { ok: false, error: "Invalid hex color." };
    const { error } = await sb.from("colors").update({ hex }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    rev();
    return { ok: true };
  } catch {
    return { ok: false, error: "Not allowed." };
  }
}
