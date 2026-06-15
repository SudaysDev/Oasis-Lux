import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AuthExperience } from "@/components/auth/AuthExperience";
import { SignedInNotice } from "@/components/auth/SignedInNotice";
import { authConfig } from "@/lib/auth/server";
import { loginAction, logoutAction, requestOtp } from "../actions";
import type { Role } from "@/types";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, username, role")
      .eq("id", user.id)
      .maybeSingle();
    return (
      <SignedInNotice
        email={profile?.email ?? user.email ?? undefined}
        username={profile?.username}
        role={profile?.role as Role | undefined}
        logoutAction={logoutAction}
      />
    );
  }

  return (
    <AuthExperience
      mode="login"
      submitAction={loginAction}
      requestOtp={requestOtp}
      adminEmail={authConfig.adminEmails[0]}
    />
  );
}
