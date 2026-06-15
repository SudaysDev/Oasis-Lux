"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authConfig,
  derivePassword,
  normalizeEmail,
  isAdminEmail,
  generateOtp,
  suggestUsernameFromEmail,
} from "@/lib/auth/server";
import { sendOtpEmail } from "@/lib/email/otp";
import { SOCIAL_ORDER, type AuthFormState, type OtpResult } from "@/lib/auth/shared";
import type { Locale, Socials } from "@/types";

type Admin = ReturnType<typeof createAdminClient>;

const otpLocale = (l?: string): "en" | "ru" | "tg" =>
  l === "en" || l === "ru" || l === "tg" ? l : "ru";

// ---------------------------------------------------------------------------
// Request an OTP token, delivered by EMAIL (free — replaces paid SMS).
// ---------------------------------------------------------------------------
export async function requestOtp(
  emailRaw: string,
  purpose: "login" | "register",
  locale?: Locale,
): Promise<OtpResult> {
  const email = normalizeEmail(emailRaw);
  if (!email) return { ok: false, error: "Enter a valid email address first." };

  const admin = createAdminClient();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + authConfig.otpTtlMs).toISOString();
  const { error } = await admin
    .from("phone_otps")
    .insert({ email, code, purpose, expires_at: expiresAt });
  if (error) return { ok: false, error: "Could not issue a code. Try again." };

  // Dev convenience: echo the code straight to the UI (no inbox needed).
  if (authConfig.devOtpEcho) {
    return { ok: true, devCode: code, masterHint: authConfig.devOtp || undefined };
  }

  const sent = await sendOtpEmail(email, code, otpLocale(locale));
  if (!sent.ok) {
    return { ok: false, error: "Could not send the code to that address. Check it and try again." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Shared helpers (not exported => not callable as actions)
// ---------------------------------------------------------------------------
async function verifyOtp(admin: Admin, email: string, code: string): Promise<boolean> {
  // Master dev code is honoured ONLY in dev/echo mode — never a prod backdoor.
  if (authConfig.devOtpEcho && authConfig.devOtp && code === authConfig.devOtp) return true;
  const { data } = await admin
    .from("phone_otps")
    .select("id")
    .eq("email", email)
    .eq("code", code)
    .eq("consumed", false)
    .gt("expires_at", new Date().toISOString())
    .order("id", { ascending: false })
    .limit(1);
  if (data && data.length) {
    await admin.from("phone_otps").update({ consumed: true }).eq("id", data[0].id);
    return true;
  }
  return false;
}

/** Mint a real Supabase session cookie for the email's user (self-heals a drifted password). */
async function establishSession(email: string, userId: string): Promise<void> {
  const password = derivePassword(email);
  const supabase = await createClient();
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(userId, { password });
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) throw new Error(`establishSession: ${error.message}`);
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const otp = String(formData.get("otp") ?? "").trim();

  const fieldErrors: NonNullable<AuthFormState>["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter a valid email address.";
  if (!/^\d{6}$/.test(otp)) fieldErrors.otp = "Enter the 6-digit code.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const admin = createAdminClient();
  if (!(await verifyOtp(admin, email!, otp))) return { fieldErrors: { otp: "Invalid or expired code." } };

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email!)
    .maybeSingle();
  if (!profile) return { error: "No identity found for this email. Switch to Register." };

  try {
    await establishSession(email!, profile.id);
  } catch {
    return { error: "Could not start the session. Try again." };
  }
  redirect("/home");
}

// ---------------------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------------------
export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const otp = String(formData.get("otp") ?? "").trim();
  const promo = String(formData.get("promo") ?? "").trim();
  const terms = formData.get("terms");

  const socials: Socials = {};
  for (const k of SOCIAL_ORDER) {
    const v = String(formData.get(`social_${k}`) ?? "").trim();
    if (v) socials[k] = v;
  }

  const fieldErrors: NonNullable<AuthFormState>["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter a valid email address.";
  if (!/^\d{6}$/.test(otp)) fieldErrors.otp = "Enter the 6-digit code.";
  if (Object.keys(socials).length === 0)
    fieldErrors.socials = "Connect at least one identity (Telegram, Instagram, TikTok or WhatsApp).";
  if (!(terms === "on" || terms === "true")) fieldErrors.terms = "Accept the protocol to continue.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const admin = createAdminClient();
  if (!(await verifyOtp(admin, email!, otp))) return { fieldErrors: { otp: "Invalid or expired code." } };

  // Already registered? Just sign them in.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email!)
    .maybeSingle();
  if (existing) {
    try {
      await establishSession(email!, existing.id);
    } catch {
      return { error: "This email already has an identity, but sign-in failed. Try Login." };
    }
    redirect("/home");
  }

  // Validate optional invite/promo.
  type PromoRow = { id: string; type: string; value: number; used_count: number };
  let promoRow: PromoRow | null = null;
  if (promo) {
    const { data } = await admin
      .from("promo_codes")
      .select("id, type, value, used_count")
      .ilike("code", promo)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) return { fieldErrors: { promo: "Unknown or inactive code." } };
    promoRow = data as PromoRow;
  }

  // Create the auth user (real email + deterministic password).
  const role = isAdminEmail(email!) ? "admin" : "customer";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email!,
    password: derivePassword(email!),
    email_confirm: true,
    user_metadata: { email: email!, role, socials },
  });
  if (createErr || !created?.user) return { error: "Could not initialize identity. Try again." };
  const userId = created.user.id;

  // Insert the profile (retry username on a unique clash).
  let username = suggestUsernameFromEmail(email!);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await admin
      .from("profiles")
      .insert({ id: userId, username, email: email!, role, socials });
    if (!error) {
      lastErr = null;
      break;
    }
    lastErr = error;
    if (String(error.message).toLowerCase().includes("username")) {
      username = suggestUsernameFromEmail(email!);
      continue;
    }
    break;
  }
  if (lastErr) {
    await admin.auth.admin.deleteUser(userId); // roll back so the email is reusable
    return { error: "Could not save the profile. Try again." };
  }

  // Apply the invite bonus.
  if (promoRow) {
    await admin
      .from("promo_redemptions")
      .insert({ promo_id: promoRow.id, user_id: userId, context: "signup" });
    await admin
      .from("promo_codes")
      .update({ used_count: (promoRow.used_count ?? 0) + 1 })
      .eq("id", promoRow.id);
    if (promoRow.type === "cashback") {
      await admin.from("profiles").update({ cashback_balance: Number(promoRow.value) }).eq("id", userId);
    } else {
      await admin
        .from("profiles")
        .update({ loyalty_points: Math.round(Number(promoRow.value)) })
        .eq("id", userId);
    }
  }

  // Welcome notification (in-app, real).
  await admin.from("notifications").insert({
    user_id: userId,
    type: "system",
    title: "Welcome to OASIS LUX",
    body: "Your identity is live. Complete your profile and explore the catalog.",
  });
  if (promoRow) {
    await admin.from("notifications").insert({
      user_id: userId,
      type: "promo",
      title: "Invite bonus applied",
      body: "Your promo code was accepted — enjoy the reward on your first orders.",
    });
  }

  try {
    await establishSession(email!, userId);
  } catch {
    return { error: "Identity created, but sign-in failed. Try Login." };
  }
  redirect("/home");
}

// ---------------------------------------------------------------------------
// LOGOUT (used by the app shell later)
// ---------------------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
