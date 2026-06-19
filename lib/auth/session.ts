import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale, Profile, ProfileLink, Role, Socials, Theme } from "@/types";

interface ProfileRow {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  phone: string;
  role: Role;
  socials: Socials | null;
  birthday: string | null;
  links: ProfileLink[] | null;
  telegram_chat_id: string | null;
  loyalty_tier: Profile["loyaltyTier"];
  loyalty_points: number | null;
  cashback_balance: number | string | null;
  locale: Locale;
  theme: Theme;
  bio: string | null;
  plan: Profile["plan"] | null;
  is_verified: boolean | null;
  show_phone: boolean | null;
  created_at: string;
}

export function mapProfileRow(r: ProfileRow): Profile {
  return {
    id: r.id,
    username: r.username,
    fullName: r.full_name ?? "",
    avatarUrl: r.avatar_url ?? undefined,
    bannerUrl: r.banner_url ?? undefined,
    phone: r.phone,
    role: r.role,
    socials: r.socials ?? {},
    birthday: r.birthday ?? undefined,
    links: Array.isArray(r.links) ? r.links : [],
    telegramChatId: r.telegram_chat_id ?? undefined,
    loyaltyTier: r.loyalty_tier,
    loyaltyPoints: r.loyalty_points ?? 0,
    cashbackBalance: Number(r.cashback_balance ?? 0),
    locale: r.locale,
    theme: r.theme,
    bio: r.bio ?? undefined,
    plan: r.plan ?? "free",
    isVerified: r.is_verified ?? false,
    showPhone: r.show_phone ?? false,
    createdAt: r.created_at,
  };
}

/** Current signed-in profile (or null). Memoised per request render. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data ? mapProfileRow(data as ProfileRow) : null;
});

/** Gate a Server Component / page on auth. Redirects to /login when signed out. */
export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}
