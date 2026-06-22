"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft, BadgeCheck, CreditCard, MapPin, Package, Trash2, Truck, User, Wallet,
} from "lucide-react";
import { CountUp, GREEN, group, LiveStatus } from "./charts";
import { deleteOrder, markOrderPaid, setOrderStatus, type ActionResult } from "@/app/(admin)/admin/orders/[id]/actions";
import type { AdminOrderDossier } from "@/lib/data/admin-orders";

const STATUS_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#22c55e", cancelled: "#ef4444" };
const TONE: Record<string, string> = { green: "#22ff88", cyan: "#38bdf8", amber: "#fbbf24", red: "#ef4444", violet: "#a78bfa" };
const FLOW = ["placed", "processing", "out_for_delivery", "arrived", "fulfilled"] as const;
const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
const coord = (g: Record<string, unknown>) => {
  const lat = g.lat ?? g.latitude, lng = g.lng ?? g.lon ?? g.longitude;
  return typeof lat === "number" && typeof lng === "number" ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "—";
};

export function OrderDossierClient({ d }: { d: AdminOrderDossier }) {
  const router = useRouter();
  const o = d.order;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const run = (fn: () => Promise<ActionResult>, ok = "Updated") => {
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(ok); router.refresh(); }
    });
  };

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to orders</Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block"><LiveStatus /></span>
          <button onClick={() => setConfirm(true)} className="flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>

      {/* header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6" style={{ background: `linear-gradient(120deg,${STATUS_COLOR[o.status] ?? "#888"}1f,#0a0e16)` }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-black tracking-wide text-white">#{o.id.slice(0, 8)}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color={STATUS_COLOR[o.status] ?? "#888"}>{o.status.replace(/_/g, " ")}</Badge>
              <Badge color="#38bdf8">{o.region}</Badge>
              {o.promoCode && <Badge color="#a78bfa">{o.promoCode}</Badge>}
              <Badge color={o.paidAt ? "#22c55e" : "#fbbf24"}>{o.paidAt ? "paid" : "unpaid"}</Badge>
              <span className="font-mono text-[11px] text-white/40">placed {fmtDateTime(o.createdAt)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">Total</p>
            <p className="text-3xl font-black text-white"><CountUp value={o.total} /> <span className="text-base" style={{ color: GREEN }}>смн</span></p>
          </div>
        </div>
      </div>

      {/* status control */}
      <SectionTitle>Status control</SectionTitle>
      <Card glow="rgba(56,189,248,0.12)">
        <div className="flex flex-wrap items-center gap-2">
          {FLOW.map((st) => {
            const on = o.status === st;
            return (
              <button key={st} onClick={() => run(() => setOrderStatus(o.id, st), `Marked ${st.replace(/_/g, " ")}`)} disabled={busy || on}
                className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition disabled:opacity-60"
                style={on ? { borderColor: `${STATUS_COLOR[st]}77`, background: `${STATUS_COLOR[st]}1f`, color: STATUS_COLOR[st] } : { borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                {on && <BadgeCheck className="h-3.5 w-3.5" />} {st.replace(/_/g, " ")}
              </button>
            );
          })}
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button onClick={() => run(() => setOrderStatus(o.id, "cancelled"), "Order cancelled")} disabled={busy || o.status === "cancelled"} className="flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/10 disabled:opacity-60">Cancel order</button>
          {!o.paidAt && <button onClick={() => run(() => markOrderPaid(o.id), "Marked paid")} disabled={busy} className="flex items-center gap-2 rounded-xl border border-[#22ff88]/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#22ff88] transition hover:bg-[#22ff88]/10 disabled:opacity-60">Mark paid</button>}
        </div>
      </Card>

      {/* money */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Subtotal" value={o.subtotal} unit="смн" accent="#38bdf8" />
        <Stat label="Discount" value={o.discount} unit="смн" accent="#fb7185" />
        <Stat label="Delivery" value={o.deliveryFee} unit="смн" accent="#fbbf24" />
        <Stat label="Total" value={o.total} unit="смн" Icon={Wallet} />
      </div>

      {/* items */}
      <SectionTitle>Items · {d.items.length}</SectionTitle>
      <Card glow="rgba(34,255,136,0.1)">
        <div className="no-scrollbar max-h-[400px] divide-y divide-white/5 overflow-y-auto">
          {d.items.length === 0 && <Empty text="No items recorded." />}
          {d.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5">
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.image ? <img src={it.image} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Package className="h-5 w-5 text-white/20" /></span>}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/admin/products/${it.productId}`} className="truncate text-sm font-semibold text-white hover:underline">{it.title}</Link>
                <p className="font-mono text-[10px] text-white/40">{it.variant ? `${it.variant} · ` : ""}×{it.qty} · {group(it.unitPrice)} смн each</p>
              </div>
              <span className="font-mono text-sm font-bold text-white">{group(it.qty * it.unitPrice)} смн</span>
            </div>
          ))}
        </div>
      </Card>

      {/* parties + payment + delivery */}
      <SectionTitle>Parties &amp; logistics</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(56,189,248,0.1)">
          <CardHead kicker="Buyer" title={d.buyer ? `@${d.buyer.username}` : "Unknown"} Icon={User} />
          {d.buyer ? (
            <div className="space-y-2">
              <Link href={`/admin/users/${d.buyer.id}`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/5">Open dossier</Link>
              <Field label="Email" value={d.buyer.email ?? "—"} />
              <Field label="Account phone" value={d.buyer.phone ?? "—"} />
            </div>
          ) : <Empty text="Buyer not found." />}
        </Card>
        <Card glow="rgba(167,139,250,0.1)">
          <CardHead kicker="Seller" title={d.seller ? `@${d.seller.username}` : "Marketplace / mixed"} Icon={Package} />
          {d.seller ? <Link href={`/admin/users/${d.seller.id}`} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/5">Open dossier</Link> : <Empty text="No single seller on this order." />}
        </Card>
        <Card glow="rgba(34,197,94,0.1)">
          <CardHead kicker="Payment" title={o.paidAt ? "Paid" : "Awaiting payment"} Icon={CreditCard} />
          <div className="space-y-2">
            <Field label="Card" value={o.cardLast4 ? `${o.cardBrand || "Card"} •••• ${o.cardLast4}` : "—"} />
            <Field label="Paid at" value={fmtDateTime(o.paidAt)} />
            <Field label="Stock settled" value={o.stockSettled ? "Yes" : "No (within cancel window)"} />
            <Field label="Cancel window closes" value={fmtDateTime(o.cancelDeadline)} />
          </div>
        </Card>
        <Card glow="rgba(251,191,36,0.1)">
          <CardHead kicker="Delivery" title={o.region} Icon={Truck} />
          <div className="space-y-2">
            <Field label="Recipient" value={`${o.fullName} · ${o.phone}`} />
            <Field label="Address" value={o.address} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Courier" value={`${d.courier.name || "—"}`} />
              <Field label="Vehicle" value={d.courier.vehicle || "—"} />
              <Field label="Distance" value={`${d.courier.distanceKm} km`} />
              <Field label="ETA" value={`${d.courier.etaMin} min`} />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
              <MapPin className="h-3.5 w-3.5 text-white/40" />
              <span className="font-mono text-[11px] text-white/60">{coord(d.geo.origin)} → {coord(d.geo.destination)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* timeline */}
      <SectionTitle>Timeline</SectionTitle>
      <Card glow="rgba(34,255,136,0.1)">
        <div className="relative ml-2 space-y-4 border-l border-white/10 pl-6">
          {d.timeline.map((e) => (
            <div key={e.id} className="relative">
              <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#070a10]" style={{ background: TONE[e.tone] ?? GREEN, boxShadow: `0 0 8px ${TONE[e.tone] ?? GREEN}` }} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider" style={{ background: `${TONE[e.tone] ?? GREEN}22`, color: TONE[e.tone] ?? GREEN }}>{e.kind}</span>
                <span className="text-sm text-white/80">{e.text}</span>
                <span className="font-mono text-[10px] text-white/35">{fmtDateTime(e.at)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(false)}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0a0e16] p-5">
              <p className="flex items-center gap-2 font-bold text-white"><Trash2 className="h-5 w-5 text-red-400" /> Delete order #{o.id.slice(0, 8)}?</p>
              <p className="mt-2 text-sm text-white/60">Removes the order and its items permanently. Prefer cancelling if you might reverse it.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setConfirm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5">Cancel</button>
                <button onClick={() => startTransition(() => deleteOrder(o.id))} className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/30">Delete forever</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Card({ children, className = "", glow = "rgba(34,255,136,0)" }: { children: React.ReactNode; className?: string; glow?: string }) {
  return <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl ${className}`}><div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: glow }} /><div className="relative">{children}</div></div>;
}
function CardHead({ kicker, title, Icon }: { kicker: string; title: string; Icon?: typeof Wallet }) {
  return <div className="mb-4 flex items-center gap-2.5">{Icon && <Icon className="h-4 w-4" style={{ color: GREEN }} />}<div><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</p><h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2></div></div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-9 flex items-center gap-3"><span className="h-px flex-1" style={{ background: "linear-gradient(90deg,transparent,rgba(34,255,136,0.4))" }} /><span className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>{children}</span><span className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(34,255,136,0.4),transparent)" }} /></div>;
}
function Stat({ label, value, unit, accent = GREEN, Icon }: { label: string; value: number; unit?: string; accent?: string; Icon?: typeof Wallet }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>{Icon && <Icon className="h-4 w-4" style={{ color: accent }} />}</div>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>{children}</span>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</p><p className="mt-0.5 break-words text-sm text-white">{value || "—"}</p></div>;
}
function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-white/40">{text}</p>; }
