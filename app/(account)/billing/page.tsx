import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { BillingView } from "@/components/billing/BillingView";

export const metadata: Metadata = { title: "Plans & billing" };

export default async function BillingPage() {
  const viewer = await requireUser();
  return (
    <DashboardShell profile={viewer}>
      <BillingView profile={viewer} />
    </DashboardShell>
  );
}
