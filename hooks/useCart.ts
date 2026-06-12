"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addToCart, removeFromCart, setQuantity } from "@/store";
import { getBrowserClient } from "@/lib/supabase/client";
import { deleteCartLine, upsertCartLine } from "@/lib/supabase/persistence";
import { useAuth } from "./useAuth";
import type { CartItem } from "@/types";

/** Cart actions — optimistic Redux update + write-through to Supabase (per-user). */
export function useCart() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isAuthed, loading, profile } = useAuth();
  const items = useAppSelector((s) => s.cart.items);
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const userId = profile?.id;

  const gate = (): boolean => {
    if (loading) return false; // session still resolving — ignore the click
    if (!isAuthed) {
      toast.error("Sign in to add items to your cart");
      router.push("/login");
      return false;
    }
    return true;
  };

  const sameLine = (i: CartItem, item: CartItem) =>
    i.productId === item.productId && i.variantId === item.variantId;

  /** Add without the auth gate (for already-authenticated areas like /home). */
  const addRaw = (item: CartItem) => {
    const existing = items.find((i) => sameLine(i, item))?.quantity ?? 0;
    const nextQty = existing + item.quantity;
    dispatch(addToCart(item));
    toast.success(`${item.title} → cart`);
    if (userId) void upsertCartLine(getBrowserClient(), userId, item, nextQty).catch(() => {});
  };

  /** Add with the auth gate (for public areas like the landing). */
  const add = (item: CartItem) => {
    if (!gate()) return;
    addRaw(item);
  };

  const remove = (productId: string, variantId?: string) => {
    dispatch(removeFromCart({ productId, variantId }));
    if (userId) void deleteCartLine(getBrowserClient(), userId, productId, variantId).catch(() => {});
  };

  const changeQty = (productId: string, quantity: number, variantId?: string) => {
    dispatch(setQuantity({ productId, quantity, variantId }));
    const line = items.find((i) => i.productId === productId && i.variantId === variantId);
    if (userId && line) {
      void upsertCartLine(getBrowserClient(), userId, line, Math.max(1, quantity)).catch(() => {});
    }
  };

  return { items, count, add, addRaw, remove, changeQty, isAuthed };
}
