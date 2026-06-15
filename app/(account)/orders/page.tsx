import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { OrdersView } from "@/components/order/OrdersView";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <OrdersView />
    </DashboardShell>
  );
}
