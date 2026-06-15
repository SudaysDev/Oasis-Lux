import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { TransactionsView } from "@/components/order/TransactionsView";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <TransactionsView />
    </DashboardShell>
  );
}
