import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { CheckoutView } from "@/components/checkout/CheckoutView";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const profile = await requireUser();
  return (
    <DashboardShell profile={profile}>
      <CheckoutView profile={profile} />
    </DashboardShell>
  );
}
