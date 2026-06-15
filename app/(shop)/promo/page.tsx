import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { PromoView } from "@/components/promo/PromoView";

export const metadata: Metadata = { title: "Promo Codes" };

export default async function PromoPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <PromoView profile={profile} />
    </DashboardShell>
  );
}
