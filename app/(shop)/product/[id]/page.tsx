import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { DashboardShell } from "@/components/app/DashboardShell";
import { ProductDetail } from "@/components/shop/ProductDetail";

export const metadata: Metadata = { title: "Product" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const { id } = await params;
  return (
    <DashboardShell profile={profile}>
      {/* key remounts the view when navigating between products (recommendations) */}
      <ProductDetail key={id} productId={id} />
    </DashboardShell>
  );
}
