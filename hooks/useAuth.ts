"use client";

import { useAppSelector } from "@/store/hooks";

/** Client-side mirror of the session (hydrated by <AuthSync/>). */
export function useAuth() {
  const profile = useAppSelector((s) => s.auth.profile);
  const loading = useAppSelector((s) => s.auth.loading);
  return { profile, isAuthed: Boolean(profile), loading };
}
