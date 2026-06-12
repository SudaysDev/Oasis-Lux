// Browser-side persistence for cart & favorites (RLS scopes every row to the user).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItem } from "@/types";

interface CartRow {
  product_id: string;
  variant_id: string;
  title: string;
  image: string;
  unit_price: number | string;
  variant_label: string | null;
  quantity: number;
}

function rowToCartItem(r: CartRow): CartItem {
  return {
    productId: r.product_id,
    variantId: r.variant_id || undefined,
    title: r.title,
    image: r.image,
    unitPrice: Number(r.unit_price),
    variantLabel: r.variant_label ?? undefined,
    quantity: r.quantity,
  };
}

// ---- cart ------------------------------------------------------------------
export async function loadCartRows(sb: SupabaseClient, userId: string): Promise<CartItem[]> {
  const { data } = await sb
    .from("cart_items")
    .select("product_id, variant_id, title, image, unit_price, variant_label, quantity")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => rowToCartItem(r as CartRow));
}

/** Upsert a line with an *absolute* quantity (Redux is the source of truth). */
export async function upsertCartLine(
  sb: SupabaseClient,
  userId: string,
  item: CartItem,
  quantity: number,
): Promise<void> {
  await sb.from("cart_items").upsert(
    {
      user_id: userId,
      product_id: item.productId,
      variant_id: item.variantId ?? "",
      title: item.title,
      image: item.image ?? "",
      unit_price: item.unitPrice,
      variant_label: item.variantLabel ?? null,
      quantity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,product_id,variant_id" },
  );
}

export async function deleteCartLine(
  sb: SupabaseClient,
  userId: string,
  productId: string,
  variantId?: string,
): Promise<void> {
  await sb
    .from("cart_items")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("variant_id", variantId ?? "");
}

export async function clearCartRows(sb: SupabaseClient, userId: string): Promise<void> {
  await sb.from("cart_items").delete().eq("user_id", userId);
}

// ---- favorites -------------------------------------------------------------
export async function loadFavoriteIds(sb: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await sb.from("favorites").select("product_id").eq("user_id", userId);
  return (data ?? []).map((r) => (r as { product_id: string }).product_id);
}

export async function addFavoriteRow(sb: SupabaseClient, userId: string, productId: string): Promise<void> {
  await sb
    .from("favorites")
    .upsert({ user_id: userId, product_id: productId }, { onConflict: "user_id,product_id" });
}

export async function removeFavoriteRow(sb: SupabaseClient, userId: string, productId: string): Promise<void> {
  await sb.from("favorites").delete().eq("user_id", userId).eq("product_id", productId);
}
