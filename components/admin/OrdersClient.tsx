"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, ChevronLeft, ChevronRight, MapPin, Package, Search, Ticket, X } from "lucide-react";
import { AreaChart, CountUp, GREEN, group, LiveStatus, StatusBars } from "./charts";
import { Select } from "./Select";
import type { AdminOrdersList, AdminOrderRow } from "@/lib/data/admin-orders";

const STATUS_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#22c55e", cancelled: "#ef4444" };
const STATUSES = ["all", "placed", "processing", "out_for_delivery", "arrived", "fulfilled", "cancelled"] as const;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const SORTS = [{ id: "new", label: "Newest" }, { id: "old", label: "Oldest" }, { id: "high", label: "Highest total" }, { id: "low", label: "Lowest total" }] as const;
type SortId = (typeof SORTS)[number]["id"];

export function OrdersClient({ data }: { data: AdminOrdersList }) {
  const s = data.summary;
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [sort, setSort] = useState<SortId>("new");
  const [page, setPage] = useState(0);
  const reset = () => setPage(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (needle && !`${o.id} ${o.buyer} ${o.seller ?? ""} ${o.region} ${o.promoCode ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by: Record<SortId, (a: AdminOrderRow, b: AdminOrderRow) => number> = {
      new: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      old: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      high: (a, b) => b.total - a.total,
      low: (a, b) => a.total - b.total,
    };
    return [...list].sort(by[sort]);
  }, [data.orders, q, status, sort]);

  const count = (st: string) => (st === "all" ? data.orders.length : data.orders.filter((o) => o.status === st).length);
  const PAGE = 14;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Orders</p><LiveStatus /></div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Every order</h1>
          <p className="mt-1.5 text-sm text-white/55">Track, filter and control every order on the grid. Click any order for its full dossier.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Orders" value={s.total} accent="#38bdf8" />
        <Tile label="Revenue" value={s.revenue} unit="смн" accent="#22ff88" />
        <Tile label="Avg order" value={s.aov} unit="смн" accent="#a78bfa" />
        <Tile label="In flight" value={s.inFlight} accent="#fbbf24" />
        <Tile label="Fulfilled" value={s.fulfilled} accent="#34d399" />
        <Tile label="Cancelled" value={s.cancelled} accent="#ef4444" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(34,255,136,0.12)"><CardHead kicker="30-day" title="Revenue" /><AreaChart data={data.revenue30d} unit=" смн" /></Card>
        <Card glow="rgba(56,189,248,0.12)"><CardHead kicker="Pipeline" title="By status" /><StatusBars data={data.byStatus} /></Card>
      </div>

      <div className="sticky top-[68px] z-20 mt-6 rounded-2xl border border-white/10 bg-[#070a10]/85 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Search className="h-4 w-4 text-white/40" />
            <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search id, buyer, seller, region, promo…" className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
            {q && <button onClick={() => { setQ(""); reset(); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
          <Select value={sort} onChange={(v) => { setSort(v as SortId); reset(); }} options={SORTS.map((o) => ({ value: o.id, label: o.label }))} Icon={ArrowDownUp} className="w-44" />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {STATUSES.map((st) => (
            <button key={st} onClick={() => { setStatus(st); reset(); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition" style={status === st ? { background: `${st === "all" ? GREEN : STATUS_COLOR[st]}1f`, color: st === "all" ? GREEN : STATUS_COLOR[st], boxShadow: `inset 0 0 0 1px ${st === "all" ? GREEN : STATUS_COLOR[st]}55` } : { color: "rgba(255,255,255,0.55)" }}>
              {st.replace(/_/g, " ")} · {count(st)}
            </button>
          ))}
          <span className="ml-auto font-mono text-[11px] text-white/45">{filtered.length} shown</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5">
        {filtered.length === 0 && <p className="py-16 text-center text-sm text-white/40">No orders match.</p>}
        <AnimatePresence initial={false}>
          {pageItems.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.4) }}>
              <Link href={`/admin/orders/${o.id}`} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/25 hover:bg-white/[0.05]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${STATUS_COLOR[o.status] ?? "#888"}1f`, color: STATUS_COLOR[o.status] ?? "#888" }}><Package className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-white">#{o.id.slice(0, 8)} <span className="font-normal text-white/55">· @{o.buyer}</span></p>
                  <p className="flex items-center gap-2 truncate font-mono text-[11px] text-white/45">
                    <MapPin className="h-3 w-3" />{o.region} · {o.items} item{o.items === 1 ? "" : "s"}{o.promoCode ? <span className="inline-flex items-center gap-0.5 text-[#a78bfa]"><Ticket className="h-3 w-3" />{o.promoCode}</span> : null} · {fmtDate(o.createdAt)}
                  </p>
                </div>
                <div className="hidden items-center gap-5 md:flex">
                  {o.discount > 0 && <Metric label="Disc" value={`−${group(o.discount)}`} unit="смн" />}
                  <Metric label="Total" value={`${group(o.total)}`} unit="смн" />
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${STATUS_COLOR[o.status] ?? "#888"}1f`, color: STATUS_COLOR[o.status] ?? "#888" }}>{o.status.replace(/_/g, " ")}</span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <PageBtn disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></PageBtn>
          <span className="px-3 font-mono text-[11px] text-white/50">Page {safePage + 1} / {pageCount}</span>
          <PageBtn disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></PageBtn>
        </div>
      )}
    </div>
  );
}

function Card({ children, className = "", glow = "rgba(34,255,136,0)" }: { children: React.ReactNode; className?: string; glow?: string }) {
  return <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl ${className}`}><div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: glow }} /><div className="relative">{children}</div></div>;
}
function CardHead({ kicker, title }: { kicker: string; title: string }) {
  return <div className="mb-4"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</p><h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2></div>;
}
function Tile({ label, value, accent, unit }: { label: string; value: number; accent: string; unit?: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </motion.div>
  );
}
function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="text-right"><p className="font-mono text-[9px] uppercase tracking-wider text-white/35">{label}</p><p className="font-mono text-sm font-bold text-white">{value}{unit && <span className="ml-0.5 text-[10px] text-white/40">{unit}</span>}</p></div>;
}
function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">{children}</button>;
}
