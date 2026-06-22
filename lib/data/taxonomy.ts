import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Public taxonomy reads (brands · colors · tags) — the SINGLE SOURCE shared by
 * the storefront (sell form, catalog filters) and the admin Taxonomy page. RLS
 * allows everyone to read these tables, so admin additions show up for every
 * client across the whole site.
 */

export async function getBrandsList(): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("brands").select("name").order("name", { ascending: true });
  return (data ?? []).map((b: { name: string }) => b.name);
}

export async function getColorsList(): Promise<{ name: string; hex: string }[]> {
  const sb = await createClient();
  const { data } = await sb.from("colors").select("name,hex").order("created_at", { ascending: true });
  return (data ?? []) as { name: string; hex: string }[];
}

export async function getTagsList(): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("tags").select("name").order("name", { ascending: true });
  return (data ?? []).map((t: { name: string }) => t.name);
}
