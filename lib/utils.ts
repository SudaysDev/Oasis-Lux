import type { Currency } from "@/types";
import { CURRENCY_META } from "@/lib/config";

/** Minimal className combiner (no extra deps). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const group = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Format a TJS-base amount in the given currency (converts + real symbol). */
export function formatPrice(amountTjs: number, currency: Currency = "TJS"): string {
  const m = CURRENCY_META[currency] ?? CURRENCY_META.TJS;
  const converted = amountTjs * m.rate;
  const n = m.prefix && converted < 100 ? converted.toFixed(1) : group(Math.round(converted));
  return m.prefix ? `${m.symbol}${n}` : `${n} ${m.symbol}`;
}

export function formatDistanceKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function formatEta(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Tajikistan phone helpers (identifier = +992 + 9 national digits)
// ---------------------------------------------------------------------------
export const TJ_DIAL = "+992";
export const TJ_NATIONAL_LEN = 9;

/** Keep only the 9 national digits a user typed (drops +992 / 992 prefix & spaces). */
export function tjNationalDigits(input: string): string {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.startsWith("992")) d = d.slice(3);
  return d.slice(0, TJ_NATIONAL_LEN);
}

/** Canonical E.164 form `+992XXXXXXXXX`, or null when not a valid TJ number. */
export function normalizeTjPhone(input: string): string | null {
  const nat = tjNationalDigits(input);
  return nat.length === TJ_NATIONAL_LEN ? `${TJ_DIAL}${nat}` : null;
}

export function isValidTjPhone(input: string): boolean {
  return normalizeTjPhone(input) !== null;
}

/** Pretty mask for display: `+992 90 123 45 67` (partial input tolerated). */
export function formatTjPhone(input: string): string {
  const n = tjNationalDigits(input);
  const parts = [n.slice(0, 2), n.slice(2, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean);
  return parts.length ? `${TJ_DIAL} ${parts.join(" ")}` : TJ_DIAL;
}
