import "server-only";
import { createHmac, randomInt } from "node:crypto";
import { normalizeTjPhone } from "@/lib/utils";

/**
 * Server-only auth helpers for the free phone+OTP flow.
 *
 * Strategy: phone (+992) is the identity. OTP proves phone ownership (free dev
 * code today; Telegram/SMS later). Behind the scenes each phone maps to a
 * Supabase auth user with a *synthetic email* and a *deterministic password*
 * (HMAC of the phone with AUTH_SECRET). The password is an internal mechanism
 * to mint a Supabase session after the OTP gate — it is never shown to anyone.
 */

export const authConfig = {
  authSecret: process.env.AUTH_SECRET ?? "",
  /** Universal master OTP for dev/demo (always verifies). Empty disables it. */
  devOtp: process.env.DEV_OTP ?? "",
  /** When true, requested OTPs are echoed back to the client UI. */
  devOtpEcho: (process.env.DEV_OTP_ECHO ?? "false").toLowerCase() === "true",
  adminPhones: (process.env.ADMIN_PHONES ?? "")
    .split(",")
    .map((p) => normalizeTjPhone(p.trim()))
    .filter((p): p is string => Boolean(p)),
  otpTtlMs: 5 * 60 * 1000,
};

if (!authConfig.authSecret) {
  // Loud in dev so a missing secret is obvious; sign-in would otherwise silently break.
  console.warn("[auth] AUTH_SECRET is empty — set it in .env.local");
}

/** `992XXXXXXXXX@phone.oasislux.app` — valid format, never receives mail. */
export function syntheticEmail(phoneE164: string): string {
  return `${phoneE164.replace(/\D/g, "")}@phone.oasislux.app`;
}

/** Deterministic, secret per-phone password (64 hex chars). */
export function derivePassword(phoneE164: string): string {
  return createHmac("sha256", authConfig.authSecret).update(phoneE164).digest("hex");
}

export function isAdminPhone(phoneE164: string): boolean {
  return authConfig.adminPhones.includes(phoneE164);
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** `oasis_xxxxxx` handle seeded from the phone tail + entropy (uniqueness retried by caller). */
export function suggestUsername(phoneE164: string): string {
  const tail = phoneE164.slice(-4);
  const rand = Math.random().toString(36).slice(2, 6);
  return `oasis_${tail}${rand}`;
}
