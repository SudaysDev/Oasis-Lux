"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleFavorite } from "@/store";
import { getBrowserClient } from "@/lib/supabase/client";
import { addFavoriteRow, removeFavoriteRow } from "@/lib/supabase/persistence";
import { useAuth } from "./useAuth";

/** Wishlist toggle — optimistic Redux update + write-through to Supabase. */
export function useFavorites() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { isAuthed, loading, profile } = useAuth();
  const ids = useAppSelector((s) => s.favorites.ids);
  const userId = profile?.id;

  const has = (id: string) => ids.includes(id);

  /** Toggle without the auth gate (already-authenticated areas). */
  const toggleRaw = (id: string) => {
    const willAdd = !ids.includes(id);
    dispatch(toggleFavorite(id));
    if (userId) {
      const sb = getBrowserClient();
      void (willAdd ? addFavoriteRow(sb, userId, id) : removeFavoriteRow(sb, userId, id)).catch(() => {});
    }
  };

  /** Toggle with the auth gate (public areas like the landing). */
  const toggle = (id: string) => {
    if (loading) return;
    if (!isAuthed) {
      toast.error("Sign in to save favorites");
      router.push("/login");
      return;
    }
    toggleRaw(id);
  };

  return { ids, has, toggle, toggleRaw, count: ids.length };
}
