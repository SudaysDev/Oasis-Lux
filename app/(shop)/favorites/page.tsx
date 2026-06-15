import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { FavoritesView } from "@/components/shop/FavoritesView";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <FavoritesView />
    </DashboardShell>
  );
}
