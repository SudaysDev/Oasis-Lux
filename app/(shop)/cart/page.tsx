import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { CartView } from "@/components/shop/CartView";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <CartView />
    </DashboardShell>
  );
}
