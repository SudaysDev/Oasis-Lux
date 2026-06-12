import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getProfileBundle } from "@/lib/data/profile";
import { DashboardShell } from "@/components/app/DashboardShell";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const viewer = await requireUser();
  const bundle = await getProfileBundle(viewer.id, viewer.id);

  return (
    <DashboardShell profile={viewer}>
      {bundle && <ProfileView bundle={bundle} />}
    </DashboardShell>
  );
}
