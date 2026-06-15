import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await requireUser();
  return (
    <DashboardShell profile={viewer}>
      <SettingsView profile={viewer} />
    </DashboardShell>
  );
}
