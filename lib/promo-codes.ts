// Promo codes (demo catalog until the admin promo engine + DB fully lands).
// A promo can be a percent discount, a FIXED сомонӣ amount off, or cashback
// (% credited back as points). Values are TJS-base; the UI converts for display.
import type { PromoScope, PromoType } from "@/types";

export interface PromoDef {
  id: string; // stable promo id
  code: string;
  type: PromoType; // "percent" | "fixed" | "cashback"
  value: number; // percent (0–100) for percent/cashback, or сомонӣ amount for fixed
  scope: PromoScope; // "all" | "brand" | "category" | "product"
  scopeLabel: string; // human area, e.g. "Dior only"
  brands?: string[]; // scope === "brand" — matched case-insensitively against product.brand
  categories?: string[]; // scope === "category" — matched against product.type / category / tags
  productIds?: string[]; // scope === "product"
  tagline?: string; // short marketing line for the card
  minOrder?: number; // TJS minimum order to apply
  windowHours?: number; // once a user activates it, it stays active this many hours (default 168 = 7d)
  expiresAt?: string; // global ISO cutoff (the promo dies for everyone after this)
  locked?: boolean; // milestone-locked coupon
  lockProgress?: number; // 0..1 toward unlock
  lockHint?: string; // how to unlock
  hidden?: boolean; // not shown on the promo page, but works if typed (e.g. shared on socials)
}

export const DEFAULT_WINDOW_HOURS = 168; // 7 days

export const PROMO_STORAGE_KEY = "oasis-promo";
export const PROMO_LOCK_KEY = "oasis-promo-lock";

export const PROMOS: PromoDef[] = [
  { id: "welcome10", code: "WELCOME10", type: "percent", value: 10, scope: "all", scopeLabel: "All products", tagline: "New here? Enjoy 10% off your first order.", windowHours: 168, expiresAt: "2026-12-31" },
  { id: "oasis20", code: "OASIS20", type: "percent", value: 20, scope: "all", scopeLabel: "Orders over 500 смн", tagline: "Big basket bonus.", minOrder: 500, windowHours: 168, expiresAt: "2026-09-30" },
  { id: "minus50", code: "MINUS50", type: "fixed", value: 50, scope: "all", scopeLabel: "Any order", tagline: "A flat 50 смн off — 24h flash deal.", windowHours: 24, expiresAt: "2026-08-31" },
  { id: "watch15", code: "WATCH15", type: "percent", value: 15, scope: "category", categories: ["watch"], scopeLabel: "Watches only", tagline: "Time for a deal on watches.", windowHours: 168, expiresAt: "2026-07-31" },
  { id: "scent25", code: "SCENT25", type: "percent", value: 25, scope: "category", categories: ["perfume"], scopeLabel: "Perfumes only", tagline: "Smell luxurious for less — 24h only.", windowHours: 24, expiresAt: "2026-07-15" },
  { id: "tomford20", code: "TOMFORD20", type: "percent", value: 20, scope: "brand", brands: ["Tom Ford"], scopeLabel: "Tom Ford only", tagline: "20% off every Tom Ford piece.", windowHours: 168, expiresAt: "2026-08-15" },
  { id: "creed15", code: "CREED15", type: "percent", value: 15, scope: "brand", brands: ["Creed"], scopeLabel: "Creed only", tagline: "House of Creed — 15% off.", windowHours: 168, expiresAt: "2026-08-15" },
  { id: "cashback15", code: "CASHBACK15", type: "cashback", value: 15, scope: "all", scopeLabel: "All products", tagline: "Get 15% back as loyalty points.", windowHours: 168, expiresAt: "2026-10-31" },
  { id: "freeship", code: "FREESHIP", type: "fixed", value: 25, scope: "all", scopeLabel: "Delivery", tagline: "Covers standard delivery — 24h.", windowHours: 24, expiresAt: "2026-12-31" },
  // hidden "secret" codes — not displayed on the page, only work if someone types them
  { id: "insta25", code: "INSTA25", type: "percent", value: 25, scope: "all", scopeLabel: "All products", tagline: "Instagram-only drop.", windowHours: 24, hidden: true, expiresAt: "2026-12-31" },
  { id: "tg50", code: "TELEGRAM50", type: "fixed", value: 50, scope: "all", scopeLabel: "Any order", tagline: "From our Telegram channel.", windowHours: 168, hidden: true, expiresAt: "2026-12-31" },
  { id: "vip90", code: "VIP90", type: "percent", value: 90, scope: "all", scopeLabel: "All products", tagline: "Almost free — for our top tier.", locked: true, lockProgress: 0.35, lockHint: "Reach Platinum loyalty tier" },
  { id: "elite100", code: "ELITE100", type: "fixed", value: 100, scope: "all", scopeLabel: "Any order", tagline: "100 смн off, unlocked by big spenders.", locked: true, lockProgress: 0.6, lockHint: "Spend 5,000 смн total" },
];

/** Lightweight product shape needed to test promo scope. */
export interface PromoTarget {
  id: string;
  brand?: string;
  type?: string;
  category?: string;
  tags?: string[];
}

/** Does this promo apply to a given product? (`all` → always.) */
export function promoMatchesProduct(p: PromoDef | { scope: PromoScope; brands?: string[]; categories?: string[]; productIds?: string[] } | null | undefined, prod: PromoTarget): boolean {
  if (!p) return false;
  switch (p.scope) {
    case "all":
      return true;
    case "brand":
      return !!p.brands?.some((b) => b.toLowerCase() === (prod.brand ?? "").toLowerCase());
    case "category":
      return !!p.categories?.some((c) => c === prod.type || c === prod.category || (prod.tags ?? []).includes(c));
    case "product":
      return !!p.productIds?.includes(prod.id);
    default:
      return false;
  }
}

/** Percent a promo knocks off a single matching product (0 if it doesn't apply or isn't a percent promo). */
export function promoPercentForProduct(p: PromoDef | null | undefined, prod: PromoTarget): number {
  return p && p.type === "percent" && promoMatchesProduct(p, prod) ? p.value : 0;
}

/** Applied promo as stored in Redux + localStorage (decoupled from the catalog). */
export interface AppliedPromo {
  id: string;
  code: string;
  type: PromoType;
  value: number;
  scope: PromoScope;
  scopeLabel: string;
  activatedAt: string; // when the user activated it
  expiresAt: string; // when this activation auto-deactivates (ISO)
}

export function findPromo(code: string): PromoDef | undefined {
  const c = code.trim().toUpperCase();
  return PROMOS.find((p) => p.code === c);
}

/** Activate a promo for the current user — stamps a personal expiry window
 *  (clamped to the promo's global cutoff). Pass `fixedExpiresMs` to re-activate
 *  within an existing lock window without extending it. */
export function toApplied(p: PromoDef, now: number = Date.now(), fixedExpiresMs?: number): AppliedPromo {
  const windowMs = (p.windowHours ?? DEFAULT_WINDOW_HOURS) * 3_600_000;
  const globalMs = p.expiresAt ? new Date(p.expiresAt).getTime() : Infinity;
  const expires = fixedExpiresMs ?? Math.min(now + windowMs, globalMs);
  return {
    id: p.id,
    code: p.code,
    type: p.type,
    value: p.value,
    scope: p.scope,
    scopeLabel: p.scopeLabel,
    activatedAt: new Date(now).toISOString(),
    expiresAt: new Date(expires).toISOString(),
  };
}

/** Has this activation window passed? */
export function isAppliedExpired(a: { expiresAt?: string | null } | null | undefined, now: number = Date.now()): boolean {
  return Boolean(a?.expiresAt && now >= new Date(a.expiresAt).getTime());
}

/** Human window length, e.g. "24 hours" or "7 days". */
export function promoWindowLabel(p: PromoDef): string {
  const h = p.windowHours ?? DEFAULT_WINDOW_HOURS;
  if (h % 24 === 0) {
    const d = h / 24;
    return `${d} day${d > 1 ? "s" : ""}`;
  }
  return `${h} hour${h > 1 ? "s" : ""}`;
}

/** Upfront order discount in TJS: percent → %, fixed → сомонӣ off, cashback → 0. */
export function promoDiscount(p: { type: PromoType; value: number } | null | undefined, subtotalTjs: number): number {
  if (!p) return 0;
  if (p.type === "percent") return Math.round((subtotalTjs * p.value) / 100);
  if (p.type === "fixed") return Math.min(p.value, subtotalTjs);
  return 0; // cashback is credited after purchase, not subtracted now
}

/** Cashback earned (TJS) for cashback promos, else 0. */
export function promoCashback(p: { type: PromoType; value: number } | null | undefined, subtotalTjs: number): number {
  return p && p.type === "cashback" ? Math.round((subtotalTjs * p.value) / 100) : 0;
}

/** Short human label, currency-aware for fixed amounts. `money` formats a TJS amount. */
export function promoShort(p: { type: PromoType; value: number }, money: (n: number) => string): string {
  if (p.type === "percent") return `−${p.value}%`;
  if (p.type === "fixed") return `−${money(p.value)}`;
  return `${p.value}% cashback`;
}
