import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { CopilotClient } from "@/components/admin/CopilotClient";

export const metadata: Metadata = { title: "Admin Copilot · Admin" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/home");
  return <CopilotClient profile={profile} />;
}
