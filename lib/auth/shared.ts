// Client+server-safe auth types & constants (no secrets, no server imports).
import type { SocialPlatform } from "@/types";

export type AuthMode = "login" | "register";
export type AuthFieldKey = "phone" | "otp" | "promo" | "socials" | "terms";

/** Returned by the login/register Server Actions on failure (they redirect on success). */
export type AuthFormState =
  | { error?: string; fieldErrors?: Partial<Record<AuthFieldKey, string>> }
  | undefined;

/** Result of requesting an OTP token. */
export type OtpResult =
  | { ok: true; devCode?: string; masterHint?: string }
  | { ok: false; error: string };

export const SOCIAL_ORDER: SocialPlatform[] = ["telegram", "instagram", "tiktok", "whatsapp"];

/** UI metadata per social network (handle prefix + accent + label). */
export const SOCIAL_META: Record<
  SocialPlatform,
  { label: string; prefix: string; accent: string; placeholder: string }
> = {
  telegram:  { label: "Telegram",  prefix: "@", accent: "#2AABEE", placeholder: "durov" },
  instagram: { label: "Instagram", prefix: "@", accent: "#E1306C", placeholder: "yourhandle" },
  tiktok:    { label: "TikTok",    prefix: "@", accent: "#25F4EE", placeholder: "yourhandle" },
  whatsapp:  { label: "WhatsApp",  prefix: "+", accent: "#25D366", placeholder: "992 90 123 45 67" },
};
