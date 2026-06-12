"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/config";

/** Supabase client for use in Client Components / browser. */
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}

let browserClient: SupabaseClient | undefined;

/** Memoised browser client (reads the auth cookie → RLS-scoped to the user). */
export function getBrowserClient(): SupabaseClient {
  if (!browserClient) browserClient = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return browserClient;
}
