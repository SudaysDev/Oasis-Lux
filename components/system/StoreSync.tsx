"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { hydrateCart, hydrateFavorites, setCurrency, setLocale, setPromo, setPromoLock } from "@/store";
import { getBrowserClient } from "@/lib/supabase/client";
import { loadCartRows, loadFavoriteIds } from "@/lib/supabase/persistence";
import { isAppliedExpired, PROMO_STORAGE_KEY, PROMO_LOCK_KEY, type AppliedPromo } from "@/lib/promo-codes";
import { CURRENCY_STORAGE_KEY, CURRENCIES } from "@/lib/config";
import { LOCALE_STORAGE_KEY } from "@/components/app/LanguageSwitcher";
import { useAuth } from "@/hooks/useAuth";
import type { Currency, Locale } from "@/types";

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
      const cur = localStorage.getItem(CURRENCY_STORAGE_KEY) as Currency | null;
      if (cur && CURRENCIES.includes(cur)) dispatch(setCurrency(cur));
      // restore the period lock (kept even if the discount was deactivated)
      const lockRaw = localStorage.getItem(PROMO_LOCK_KEY);
      if (lockRaw) {
        const lock = JSON.parse(lockRaw) as { lockedCode?: string; lockedUntil?: string };
        if (lock?.lockedCode && lock.lockedUntil && Date.now() < new Date(lock.lockedUntil).getTime()) {
          dispatch(setPromoLock({ lockedCode: lock.lockedCode, lockedUntil: lock.lockedUntil }));
        } else {
          localStorage.removeItem(PROMO_LOCK_KEY);
        }
      }

      const raw = localStorage.getItem(PROMO_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<AppliedPromo>;
        if (p?.code && p.type && !isAppliedExpired(p)) {
          dispatch(setPromo({
            id: p.id ?? p.code, code: p.code, type: p.type, value: p.value ?? 0,
            scope: p.scope ?? "all", scopeLabel: p.scopeLabel ?? "",
            activatedAt: p.activatedAt ?? new Date().toISOString(),
            expiresAt: p.expiresAt ?? new Date().toISOString(),
          }));
        } else if (p && isAppliedExpired(p)) {
          localStorage.removeItem(PROMO_STORAGE_KEY); // window passed — drop it
        }
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
