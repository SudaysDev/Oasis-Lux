import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchOrder } from "@/lib/data/orders";
import { DashboardShell } from "@/components/app/DashboardShell";
import { OrderTracking } from "@/components/order/OrderTracking";

export const metadata: Metadata = { title: "Order tracking" };

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireUser();
  const { id } = await params;
  const supabase = await createClient();
  const order = await fetchOrder(supabase, id);

  return (
    <DashboardShell profile={profile}>
      {order ? (
        <OrderTracking order={order} />
      ) : (
        <div className="mx-auto grid min-h-[40vh] max-w-md place-items-center text-center">
          <div>
            <p className="text-2xl font-black">Order not found</p>
            <p className="mt-2 text-sm text-fg-muted">It may have been removed, or you don&apos;t have access.</p>
            <Link href="/orders" className="neon-border mt-6 inline-flex rounded-xl px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10">
              View all orders
            </Link>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
