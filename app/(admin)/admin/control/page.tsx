import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth/session";
import { FullControlClient } from "@/components/admin/FullControlClient";

export const metadata: Metadata = { title: "Full Control · Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await getCurrentProfile();
  return <FullControlClient operator={profile?.username ?? "operator"} />;
}
