"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { hydrateCart, hydrateFavorites, setLocale, setPromo } from "@/store";
import { getBrowserClient } from "@/lib/supabase/client";
import { loadCartRows, loadFavoriteIds } from "@/lib/supabase/persistence";
import { PROMO_STORAGE_KEY } from "@/lib/promo-codes";
import { LOCALE_STORAGE_KEY } from "@/components/app/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import type { Locale } from "@/types";

/** Loads the user's persisted cart & favorites into Redux when the session resolves. */
export function StoreSync() {
  const dispatch = useAppDispatch();
  const { profile } = useAuth();
  const userId = profile?.id;

  // restore the saved locale + active promo code from localStorage
  useEffect(() => {
    try {
      const loc = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (loc) { dispatch(setLocale(loc)); document.documentElement.lang = loc; }
      const raw = localStorage.getItem(PROMO_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { code: string; discountPercent: number };
        if (p?.code) dispatch(setPromo(p));
      }
    } catch {}
  }, [dispatch]);

  useEffect(() => {
    if (!userId) {
      dispatch(hydrateCart([]));
      dispatch(hydrateFavorites([]));
      return;
    }
    let cancelled = false;
    const sb = getBrowserClient();
    void (async () => {
      const [cart, favs] = await Promise.all([loadCartRows(sb, userId), loadFavoriteIds(sb, userId)]);
      if (cancelled) return;
      dispatch(hydrateCart(cart));
      dispatch(hydrateFavorites(favs));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, dispatch]);

  return null;
}
