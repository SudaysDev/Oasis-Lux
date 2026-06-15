"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, CircleSlash, Home, Loader2, MapPin, Package, Phone, Truck, X } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { cancelOrder, cancelDeadlineMs, haversineKm, lerpLatLng, ORDER_FLOW, type OrderRecord } from "@/lib/data/orders";
import { useMoney } from "@/hooks/useMoney";
import { formatDistanceKm, formatEta, cn } from "@/lib/utils";
import { RouteMap } from "./RouteMap";

const STATUS_LABEL: Record<string, string> = {
  placed: "Order placed",
  processing: "Processing",
  out_for_delivery: "Out for delivery",
  arrived: "Arrived",
  fulfilled: "Fulfilled",
};

export function OrderTracking({ order }: { order: OrderRecord }) {
  const router = useRouter();
  const { money } = useMoney();
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [confirm, setConfirm] = useState(false);

  // live clock for the ETA + cancel-window tickers
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // lazy stock settlement once the cancel window closes
  useEffect(() => {
    void fetch("/api/orders/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: order.id }),
    })
      .then((r) => r.json())
      .then((j: { settled?: boolean }) => { if (j.settled) router.refresh(); })
      .catch(() => {});
  }, [order.id, router]);

  const cancelled = order.status === "cancelled";
  const paidMs = new Date(order.paidAt ?? order.createdAt).getTime();
  const etaTarget = paidMs + order.etaMin * 60_000;
  const remainingMs = Math.max(0, etaTarget - now);
  const remainingMin = remainingMs / 60_000;
  const progress = order.etaMin > 0 ? Math.min(1, (order.etaMin - remainingMin) / order.etaMin) : 1;
  // REAL remaining distance: great-circle from the courier's current point to the destination
  const current = lerpLatLng(order.origin, order.destination, progress);
  const remainingKm = haversineKm(current, order.destination);

  const deadline = cancelDeadlineMs(order);
  const cancelMs = Math.max(0, deadline - now);
  const cancellable = !cancelled && order.status !== "fulfilled" && cancelMs > 0;
  const cancelSec = Math.ceil(cancelMs / 1000);
  const mm = String(Math.floor(cancelSec / 60)).padStart(2, "0");
  const ss = String(cancelSec % 60).padStart(2, "0");

  const flowIndex = ORDER_FLOW.indexOf(order.status === "cancelled" ? "placed" : order.status);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelOrder(getBrowserClient(), order.id);
      toast.success("Order cancelled — no charge");
      setConfirm(false);
      router.refresh();
    } catch {
      toast.error("Could not cancel the order");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* celebratory banner */}
      <div className={cn("glass relative overflow-hidden rounded-3xl p-6 sm:p-8", cancelled && "opacity-90")}>
        {!cancelled && <Confetti />}
        <div className="relative">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">Order {order.id.slice(0, 8)}</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            {cancelled ? "Order cancelled" : "Thank you — order confirmed! 🎉"}
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {cancelled
              ? "This order was cancelled within the free window. No charge was settled."
              : `Heading to ${order.region}. The seller has been notified instantly.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/home"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-bold text-on-accent shadow-[0_14px_40px_-14px_var(--accent-glow)] transition hover:brightness-110"
            >
              <Home className="h-4 w-4" /> Back to home
            </Link>
            <Link
              href="/orders"
              className="glass flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:neon-border"
            >
              All orders <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT: map + pipeline */}
        <div className="flex flex-col gap-6">
          {/* real interactive Tajikistan map (drag · rotate · tilt · zoom) */}
          <section className="card overflow-hidden rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MapPin className="h-5 w-5 text-accent" /> Live route · Tajikistan
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">drag · rotate · zoom</span>
            </div>
            <div className="mt-4 h-72 w-full overflow-hidden rounded-xl border border-[var(--panel-border)] sm:h-80">
              <RouteMap origin={order.origin} destination={order.destination} progress={progress} done={cancelled} />
            </div>
            {!cancelled && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Distance left" value={formatDistanceKm(remainingKm)} />
                <Metric label="ETA" value={remainingMin < 1 ? "Arriving now" : formatEta(remainingMin)} />
              </div>
            )}
          </section>

          {/* status pipeline */}
          <section className="card rounded-2xl p-5">
            <h2 className="text-lg font-bold">Shipping progress</h2>
            {cancelled ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                <CircleSlash className="h-4 w-4" /> Order cancelled
              </div>
            ) : (
              <ol className="mt-4 space-y-4">
                {ORDER_FLOW.map((s, i) => {
                  const done = i <= flowIndex;
                  const active = i === flowIndex;
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <span className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full border transition",
                        done ? "border-accent bg-accent text-on-accent" : "border-[var(--panel-border)] text-fg-muted",
                        active && "shadow-[0_0_14px_var(--accent-glow)]",
                      )}>
                        {done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs">{i + 1}</span>}
                      </span>
                      <span className={cn("text-sm", done ? "font-semibold" : "text-fg-muted")}>{STATUS_LABEL[s]}</span>
                      {active && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-accent">current</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        {/* RIGHT: courier + items + cancel */}
        <div className="flex flex-col gap-6">
          {!cancelled && (
            <section className="card rounded-2xl p-5">
              <h2 className="text-lg font-bold">Courier</h2>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 text-accent">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{order.courierName}</p>
                  <p className="font-mono text-[11px] text-fg-muted">{order.courierVehicle}</p>
                </div>
              </div>
              <a
                href={`tel:${order.courierPhone.replace(/\s/g, "")}`}
                className="neon-border mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-accent transition hover:bg-accent/10"
              >
                <Phone className="h-4 w-4" /> {order.courierPhone}
              </a>
            </section>
          )}

          <section className="card rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Package className="h-5 w-5 text-accent" /> Items
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {order.items.map((l) => (
                <div key={`${l.productId}-${l.variantLabel}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/product/${l.productId}`} className="line-clamp-1 font-medium transition hover:text-accent">{l.title}</Link>
                    <span className="font-mono text-[11px] text-fg-muted">
                      ×{l.quantity}{l.variantLabel ? ` · ${l.variantLabel}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{money(l.unitPrice * l.quantity)}</span>
                </div>
              ))}
            </div>
            <dl className="mt-4 flex flex-col gap-2 border-t border-[var(--panel-border)] pt-4 text-sm">
              <Row k="Subtotal" v={money(order.subtotal)} />
              {order.discount > 0 && <Row k={`Discount${order.promoCode ? ` (${order.promoCode})` : ""}`} v={`−${money(order.discount)}`} accent />}
              <Row k={`Delivery · ${order.region}`} v={money(order.deliveryFee)} />
              <div className="flex justify-between border-t border-[var(--panel-border)] pt-2 text-base font-black">
                <span>Total</span>
                <span className="text-accent">{money(order.total)}</span>
              </div>
            </dl>
            <p className="mt-3 font-mono text-[11px] text-fg-muted">
              {order.address}{order.cardLast4 ? ` · paid •••• ${order.cardLast4}` : ""}
            </p>
          </section>

          {/* cancel window */}
          {cancellable && (
            <section className="card rounded-2xl p-5">
              <p className="text-sm font-medium">Changed your mind?</p>
              <p className="mt-1 text-xs text-fg-muted">
                Free cancellation closes in <span className="font-mono font-bold text-accent">{mm}:{ss}</span>.
                After that your order is locked and stock is committed.
              </p>
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-danger/50 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
              >
                <X className="h-4 w-4" /> Cancel order
              </button>
            </section>
          )}
          {!cancelled && !cancellable && order.status !== "fulfilled" && (
            <p className="text-center font-mono text-[11px] uppercase tracking-wider text-fg-muted">
              Cancellation window closed · order locked
            </p>
          )}

          <Link
            href="/orders"
            className="text-center font-mono text-[11px] uppercase tracking-wider text-accent transition hover:underline"
          >
            View all orders
          </Link>
        </div>
      </div>

      {/* cancel confirmation */}
      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button aria-label="Close" onClick={() => setConfirm(false)} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="popover relative w-full max-w-sm rounded-2xl p-5"
            >
              <p className="text-base font-bold">Cancel this order?</p>
              <p className="mt-1 text-sm text-fg-muted">You won&apos;t be charged. This can&apos;t be undone.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-xl border border-[var(--panel-border)] py-2.5 text-sm font-medium transition hover:bg-[var(--panel)]">
                  Keep order
                </button>
                <button type="button" onClick={doCancel} disabled={cancelling} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60">
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--panel)] px-4 py-3 text-center">
      <p className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-accent">{value}</p>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-fg-muted">{k}</dt>
      <dd className={cn("tabular-nums font-medium", accent && "text-success")}>{v}</dd>
    </div>
  );
}

function Confetti() {
  const bits = Array.from({ length: 24 });
  const colors = ["#22d3ee", "#a855f7", "#34d399", "#f59e0b", "#f43f5e"];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-0 h-2 w-2 rounded-[1px]"
          style={{ left: `${(i / bits.length) * 100}%`, background: colors[i % colors.length] }}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{ y: 220, opacity: [0, 1, 1, 0], rotate: 360 }}
          transition={{ duration: 2.4, delay: (i % 8) * 0.12, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
