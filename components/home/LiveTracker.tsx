"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Phone, Truck } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchMyOrders, haversineKm, lerpLatLng, type OrderRecord } from "@/lib/data/orders";
import { useAuth } from "@/hooks/useAuth";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { formatDistanceKm, formatEta } from "@/lib/utils";
import { RouteMap } from "@/components/order/RouteMap";

const ACTIVE = new Set(["placed", "processing", "out_for_delivery", "arrived"]);

export function LiveTracker() {
  const { profile } = useAuth();
  const { money } = useMoney();
  const { t } = useT();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void fetchMyOrders(getBrowserClient(), profile.id)
      .then((orders) => {
        if (cancelled) return;
        setOrder(orders.find((o) => ACTIVE.has(o.status)) ?? null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile]);

  useEffect(() => {
    if (!order) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order]);

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${order ? "bg-accent/50" : "bg-fg-muted/40"}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${order ? "bg-accent" : "bg-fg-muted"}`} />
        </span>
        <h2 className="text-lg font-bold sm:text-xl">{t("home.tracker")}</h2>
      </div>

      {loading ? (
        <div className="glass h-72 animate-pulse rounded-3xl" />
      ) : order ? (
        <ActiveTracker order={order} now={now} money={money} />
      ) : (
        <EmptyTracker />
      )}
    </section>
  );
}

function ActiveTracker({ order, now, money }: { order: OrderRecord; now: number; money: (n: number) => string }) {
  const { t } = useT();
  const paidMs = new Date(order.paidAt ?? order.createdAt).getTime();
  const remainingMin = Math.max(0, (paidMs + order.etaMin * 60_000 - now) / 60_000);
  const progress = order.etaMin > 0 ? Math.min(1, (order.etaMin - remainingMin) / order.etaMin) : 1;
  const current = lerpLatLng(order.origin, order.destination, progress);
  const remainingKm = haversineKm(current, order.destination);

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_300px] sm:p-5">
        <div className="h-64 overflow-hidden rounded-2xl border border-[var(--panel-border)]">
          <RouteMap origin={order.origin} destination={order.destination} progress={progress} done={false} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-accent/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
              {order.status.replace(/_/g, " ")}
            </span>
            <span className="font-mono text-[11px] text-fg-muted">#{order.id.slice(0, 8)}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--panel)] px-3 py-2.5 text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-fg-muted">{t("home.distanceLeft")}</p>
              <p className="mt-0.5 text-lg font-black text-accent">{formatDistanceKm(remainingKm)}</p>
            </div>
            <div className="rounded-xl bg-[var(--panel)] px-3 py-2.5 text-center">
              <p className="font-mono text-[9px] uppercase tracking-wider text-fg-muted">{t("home.eta")}</p>
              <p className="mt-0.5 text-lg font-black text-accent">{remainingMin < 1 ? t("home.now") : formatEta(remainingMin)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--panel-border)] p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Truck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{order.courierName}</p>
              <p className="font-mono text-[10px] text-fg-muted">→ {order.region} · {money(order.total)}</p>
            </div>
            <a href={`tel:${order.courierPhone.replace(/\s/g, "")}`} aria-label="Call courier" className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition hover:text-accent">
              <Phone className="h-4 w-4" />
            </a>
          </div>

          <Link
            href={`/order/${order.id}/track`}
            className="neon-border mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            {t("home.openTracking")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const CITIES = [
  { x: 30, y: 18 }, { x: 38, y: 54 }, { x: 60, y: 72 }, { x: 82, y: 46 },
];

function EmptyTracker() {
  const { t } = useT();
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-8 text-center sm:p-12">
      <div className="grid-mesh absolute inset-0 opacity-10" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-30">
        {CITIES.slice(1).map((c, i) => (
          <line key={i} x1={CITIES[0].x} y1={CITIES[0].y} x2={c.x} y2={c.y} stroke="#22d3ee" strokeOpacity="0.25" strokeWidth="0.3" strokeDasharray="1.4 1.4" />
        ))}
      </svg>
      {CITIES.map((c, i) => (
        <span key={i} className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40" style={{ left: `${c.x}%`, top: `${c.y}%` }} />
      ))}
      <div className="relative">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
          <Truck className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t("home.noDeliveries")}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          {t("home.noDeliveriesHint")}
        </p>
        <Link href="/catalog" className="neon-border group mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 font-mono text-xs uppercase tracking-[0.15em] transition hover:scale-105">
          {t("common.browseCatalog")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
