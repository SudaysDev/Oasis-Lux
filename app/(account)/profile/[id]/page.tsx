import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfileBundle } from "@/lib/data/profile";
import { DashboardShell } from "@/components/app/DashboardShell";
import { ProfileView } from "@/components/profile/ProfileView";

export default async function ProfileByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  const bundle = await getProfileBundle(id, viewer.id);
  if (!bundle) notFound();

  return (
    <DashboardShell profile={viewer}>
      <ProfileView bundle={bundle} />
    </DashboardShell>
  );
}
