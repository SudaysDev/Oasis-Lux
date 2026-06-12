// Categories taxonomy (admin-managed in the `categories` table).
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  icon: string;
  sort: number;
}

interface Row { id: string; name: string; slug: string; parent_id: string | null; icon: string; sort: number }

export async function fetchCategories(sb: SupabaseClient): Promise<Category[]> {
  const { data } = await sb.from("categories").select("id,name,slug,parent_id,icon,sort").order("sort");
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    parentId: r.parent_id,
    icon: r.icon,
    sort: r.sort,
  }));
}

export interface CategoryGroup {
  parent: Category;
  children: Category[];
}

/** Group categories into top-level sections with their subsections. */
export function groupCategories(cats: Category[]): CategoryGroup[] {
  const tops = cats.filter((c) => !c.parentId).sort((a, b) => a.sort - b.sort);
  return tops.map((parent) => ({
    parent,
    children: cats.filter((c) => c.parentId === parent.id).sort((a, b) => a.sort - b.sort),
  }));
}
