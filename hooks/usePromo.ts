"use client";

import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setPromo, clearPromo } from "@/store";
import { useMoney } from "@/hooks/useMoney";
import { findPromo, promoShort, toApplied, PROMO_STORAGE_KEY, PROMO_LOCK_KEY } from "@/lib/promo-codes";

/**
 * Shared promo activation logic + the "one promo per period" lock.
 *  - The first activation commits the user to that code until its window passes.
 *  - While locked, NO other code can be activated (cards grey out; input rejects).
 *  - Deactivating stops the discount but keeps the lock (still can't switch).
 *  - Re-activating the SAME locked code reuses the original window (no extension).
 * Expired locks are cleared by `PromoStatus`'s timer / `StoreSync`, so a truthy
 * `lockedCode` here means an ACTIVE lock (no `Date.now()` needed during render).
 */
export function usePromo() {
  const dispatch = useAppDispatch();
  const { money } = useMoney();
  const promo = useAppSelector((s) => s.promo);
  const lockedCode = promo.lockedCode;
  const lockedUntil = promo.lockedUntil;

  /** Try to activate a code (from a card or a typed input). Returns true on success. */
  const apply = (rawCode: string): boolean => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return false;
    const def = findPromo(code);
    if (!def) {
      toast.error("Промокод не найден");
      return false;
    }
    if (def.locked) {
      toast.error("Этот промокод ещё заблокирован");
      return false;
    }
    const lockActive = Boolean(lockedUntil && Date.now() < new Date(lockedUntil).getTime());
    if (lockActive && lockedCode !== def.code) {
      toast.error(`Только один промокод за период — активен ${lockedCode} до ${new Date(lockedUntil!).toLocaleDateString()}`);
      return false;
    }
    // re-activating the locked code keeps the original window; a fresh commit starts a new one
    const applied =
      lockActive && lockedCode === def.code
        ? toApplied(def, Date.now(), new Date(lockedUntil!).getTime())
        : toApplied(def);
    dispatch(setPromo(applied));
    try {
      localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify(applied));
      localStorage.setItem(PROMO_LOCK_KEY, JSON.stringify({ lockedCode: applied.code, lockedUntil: applied.expiresAt }));
    } catch {}
    toast.success(`Промокод ${code} активирован · ${promoShort(def, money)}`);
    return true;
  };

  /** Deactivate the discount (lock stays until the window passes). */
  const deactivate = () => {
    dispatch(clearPromo());
    try { localStorage.removeItem(PROMO_STORAGE_KEY); } catch {}
  };

  return { promo, lockedCode, lockedUntil, apply, deactivate };
}
