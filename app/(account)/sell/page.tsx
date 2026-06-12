import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { SellForm } from "@/components/sell/SellForm";

export const metadata: Metadata = { title: "Sell an item" };

export default async function SellPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <SellForm profile={profile} />
    </DashboardShell>
  );
}
