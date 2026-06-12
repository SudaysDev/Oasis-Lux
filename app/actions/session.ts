"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

/** Client-callable: returns the current profile (or null) to mirror into Redux. */
export async function getMyProfile(): Promise<Profile | null> {
  return getCurrentProfile();
}

/** Sign out and return to the login terminal. */
export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
