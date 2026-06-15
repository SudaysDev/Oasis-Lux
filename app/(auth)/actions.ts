"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail, isAdminEmail, suggestUsernameFromEmail } from "@/lib/auth/server";
import { MIN_PASSWORD, SOCIAL_ORDER, type AuthFormState } from "@/lib/auth/shared";
import type { Socials } from "@/types";

// ---------------------------------------------------------------------------
// LOGIN — classic email + password (no OTP, no SMS, no email round-trip).
// ---------------------------------------------------------------------------
export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  const fieldErrors: NonNullable<AuthFormState>["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email!, password });
  if (error) return { error: "Invalid email or password." };
  redirect("/home");
}

// ---------------------------------------------------------------------------
// REGISTER — create the identity with the user's own password.
// ---------------------------------------------------------------------------
export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const promo = String(formData.get("promo") ?? "").trim();
  const terms = formData.get("terms");

  const socials: Socials = {};
  for (const k of SOCIAL_ORDER) {
    const v = String(formData.get(`social_${k}`) ?? "").trim();
    if (v) socials[k] = v;
  }

  const fieldErrors: NonNullable<AuthFormState>["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD) fieldErrors.password = `Use at least ${MIN_PASSWORD} characters.`;
  if (Object.keys(socials).length === 0)
    fieldErrors.socials = "Connect at least one identity (Telegram, Instagram, TikTok or WhatsApp).";
  if (!(terms === "on" || terms === "true")) fieldErrors.terms = "Accept the protocol to continue.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const admin = createAdminClient();

  // Already registered? Send them to login (we never silently reset passwords).
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email!)
    .maybeSingle();
  if (existing) return { fieldErrors: { email: "This email is already registered. Switch to Login." } };

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

  // Create the auth user (real email + the user's chosen password).
  const role = isAdminEmail(email!) ? "admin" : "customer";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email!,
    password,
    email_confirm: true,
    user_metadata: { email: email!, role, socials },
  });
  if (createErr || !created?.user) {
    // Most common cause: the email already exists in auth (e.g. an older account).
    return { fieldErrors: { email: "Could not register this email. Try Login or use another email." } };
  }
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

  // Sign in with the chosen password to mint the session.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: email!, password });
  if (signInErr) return { error: "Identity created, but sign-in failed. Try Login." };
  redirect("/home");
}

// ---------------------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
