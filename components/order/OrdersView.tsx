"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, PackageCheck, ShoppingBag } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchMyOrders, type OrderRecord, type OrderStatus } from "@/lib/data/orders";
import { useAuth } from "@/hooks/useAuth";
import { useMoney } from "@/hooks/useMoney";
import { cn } from "@/lib/utils";

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  placed: { label: "Placed", cls: "bg-accent/15 text-accent" },
  processing: { label: "Processing", cls: "bg-accent/15 text-accent" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-amber-400/15 text-amber-400" },
  arrived: { label: "Arrived", cls: "bg-success/15 text-success" },
  fulfilled: { label: "Fulfilled", cls: "bg-success/15 text-success" },
  cancelled: { label: "Cancelled", cls: "bg-danger/15 text-danger" },
};

export function OrdersView() {
  const { profile } = useAuth();
  const { money } = useMoney();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void fetchMyOrders(getBrowserClient(), profile.id)
      .then((o) => { if (!cancelled) setOrders(o); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black sm:text-4xl">Orders</h1>
      <p className="mt-1 text-sm text-fg-muted">Every order &amp; transaction, with live tracking.</p>

      {loading ? (
        <div className="mt-8 flex flex-col gap-3">
          {[0, 1, 2].map((i) => <div key={i} className="card h-24 animate-pulse rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="glass mt-8 grid place-items-center rounded-3xl px-6 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
            <PackageCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 text-lg font-bold">No orders yet</p>
          <p className="mt-1 text-sm text-fg-muted">Place your first order and track it live across Tajikistan.</p>
          <Link href="/catalog" className="neon-border mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10">
            Browse catalog <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {orders.map((o) => {
            const units = o.items.reduce((n, i) => n + i.quantity, 0);
            const meta = STATUS_META[o.status];
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Link href={`/order/${o.id}/track`} className="card flex items-center gap-4 rounded-2xl p-4 transition hover:neon-border">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold">#{o.id.slice(0, 8)}</span>
                      <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider", meta.cls)}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-fg-muted">
                      {units} item{units > 1 ? "s" : ""} · {o.region} · {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-accent">{money(o.total)}</p>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">Track <ArrowRight className="inline h-3 w-3" /></span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
