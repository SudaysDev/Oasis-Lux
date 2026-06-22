"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, Bike, Clock, Gauge, MapPin, Navigation, Package, Phone, Radio, Route, Truck, User,
} from "lucide-react";
import { CountUp, GREEN, group, HBars, LiveStatus } from "./charts";
import type { AdminLogistics, FleetDelivery } from "@/lib/data/admin-logistics";

const STATUS_COLOR: Record<string, string> = {
  placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24",
};
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed", processing: "Packing", out_for_delivery: "On road", arrived: "At door",
};
const STATUSES = ["all", "placed", "processing", "out_for_delivery", "arrived"] as const;

const fmtEta = (m: number) => (m <= 0 ? "overdue" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

export function LogisticsClient({ data }: { data: AdminLogistics }) {
  const s = data.summary;
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(
    () => data.deliveries.filter((d) => status === "all" || d.status === status),
    [data.deliveries, status],
  );
  const count = (st: string) => (st === "all" ? data.deliveries.length : data.deliveries.filter((d) => d.status === st).length);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Logistics</p>
            <LiveStatus />
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Live deliveries</h1>
          <p className="mt-1.5 text-sm text-white/55">Every courier in flight across Tajikistan — telemetry, routes and ETA timers, straight off the grid.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <Radio className="h-4 w-4 animate-pulse" style={{ color: GREEN }} />
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Couriers live</p>
            <p className="text-lg font-black text-white"><CountUp value={s.couriers} /></p>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="In flight" value={s.inFlight} accent="#22ff88" Icon={Truck} />
        <Tile label="On road" value={s.outForDelivery} accent="#a78bfa" Icon={Navigation} />
        <Tile label="At door" value={s.arrived} accent="#fbbf24" Icon={MapPin} />
        <Tile label="Avg ETA" value={s.avgEta} unit="min" accent="#38bdf8" Icon={Clock} />
        <Tile label="On road" value={s.onRoadKm} unit="km" accent="#34d399" Icon={Route} />
        <Tile label="In-flight" value={s.inFlightValue} unit="смн" accent="#f472b6" Icon={Gauge} />
      </div>

      {(s.overdue > 0 || s.fulfilledToday > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {s.overdue > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {s.overdue} overdue
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Package className="h-3.5 w-3.5" /> {s.fulfilledToday} delivered today
          </span>
        </div>
      )}

      {/* map + command list */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <FleetMap data={data} deliveries={filtered} selected={selected} onSelect={setSelected} />

        <div className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">Command list</p>
                <h2 className="mt-0.5 text-lg font-bold text-white">Active deliveries</h2>
              </div>
              <span className="font-mono text-[11px] text-white/45">{filtered.length}</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {STATUSES.map((st) => (
                <button key={st} onClick={() => setStatus(st)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition"
                  style={status === st
                    ? { background: `${st === "all" ? GREEN : STATUS_COLOR[st]}1f`, color: st === "all" ? GREEN : STATUS_COLOR[st], boxShadow: `inset 0 0 0 1px ${st === "all" ? GREEN : STATUS_COLOR[st]}55` }
                    : { color: "rgba(255,255,255,0.5)" }}>
                  {st === "all" ? "all" : STATUS_LABEL[st]} · {count(st)}
                </button>
              ))}
            </div>
            <div className="no-scrollbar max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {filtered.length === 0 && <p className="py-12 text-center text-sm text-white/40">No deliveries in flight.</p>}
              <AnimatePresence initial={false}>
                {filtered.map((d, i) => (
                  <motion.div key={d.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
                    <DeliveryRow d={d} active={selected === d.id} onHover={() => setSelected(d.id)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* region split + courier roster */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl lg:col-span-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">Distribution</p>
          <h2 className="mb-4 mt-0.5 text-lg font-bold text-white">By region</h2>
          {data.regions.length === 0
            ? <p className="py-8 text-center text-sm text-white/40">No active routes.</p>
            : <HBars data={data.regions.map((r) => ({ label: r.region, value: r.count }))} suffix=" runs" />}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl lg:col-span-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">Fleet</p>
          <h2 className="mb-4 mt-0.5 text-lg font-bold text-white">Couriers on shift</h2>
          {data.couriers.length === 0
            ? <p className="py-8 text-center text-sm text-white/40">No couriers on the road.</p>
            : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {data.couriers.map((c) => (
                  <div key={c.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${GREEN}1f`, color: GREEN }}>
                        {/(bike|moto|scooter|велос)/i.test(c.vehicle) ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                        <p className="truncate font-mono text-[10px] text-white/45">{c.vehicle}{c.phone ? ` · ${c.phone}` : ""}</p>
                      </div>
                      <span className="rounded-full px-2 py-0.5 font-mono text-[10px]" style={{ background: `${GREEN}1f`, color: GREEN }}>{c.active} live</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-white/45">
                      <span className="flex items-center gap-1"><Route className="h-3 w-3" />{Math.round(c.distanceKm)} km</span>
                      <span className="truncate px-2">{c.regions.join(" · ")}</span>
                      <span className="flex items-center gap-1" style={{ color: c.worstEta < 0 ? "#ef4444" : undefined }}><Clock className="h-3 w-3" />{fmtEta(c.worstEta)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================== */
/* 3D TACTICAL MAP                                                        */
/* ===================================================================== */
const VB = 100;
const px = (n: number) => 6 + n * (VB - 12); // 6% padding inside the viewBox

function FleetMap({ data, deliveries, selected, onSelect }: {
  data: AdminLogistics; deliveries: FleetDelivery[]; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#04070c] p-4 backdrop-blur-xl lg:col-span-3">
      <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: "rgba(34,255,136,0.10)" }} />
      <div className="relative mb-3 flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">Grid · Tajikistan</p>
          <h2 className="mt-0.5 text-lg font-bold text-white">Route map</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-white/45">
          <span className="h-1.5 w-1.5 animate-ping rounded-full" style={{ background: GREEN }} /> {deliveries.length} routes
        </span>
      </div>

      <div className="relative" style={{ perspective: "1200px" }}>
        <div className="relative mx-auto aspect-[4/3] w-full" style={{ transform: "rotateX(40deg)", transformStyle: "preserve-3d" }}>
          <svg viewBox={`0 0 ${VB} ${VB}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <radialGradient id="lg-floor" cx="50%" cy="40%" r="75%">
                <stop offset="0%" stopColor="#0b1a16" />
                <stop offset="100%" stopColor="#04070c" />
              </radialGradient>
              <linearGradient id="lg-route" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={GREEN} stopOpacity="0.15" />
                <stop offset="100%" stopColor={GREEN} stopOpacity="0.9" />
              </linearGradient>
              <filter id="lg-glow"><feGaussianBlur stdDeviation="0.7" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            <rect x="0" y="0" width={VB} height={VB} fill="url(#lg-floor)" rx="3" />
            {/* grid */}
            {Array.from({ length: 11 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 10} x2={VB} y2={i * 10} stroke={GREEN} strokeOpacity="0.06" strokeWidth="0.2" />
            ))}
            {Array.from({ length: 11 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2={VB} stroke={GREEN} strokeOpacity="0.06" strokeWidth="0.2" />
            ))}

            {/* routes */}
            {deliveries.map((d) => {
              const x1 = px(d.ox), y1 = px(d.oy), x2 = px(d.dx), y2 = px(d.dy);
              const mx = (x1 + x2) / 2 + (y2 - y1) * 0.14, my = (y1 + y2) / 2 - (x2 - x1) * 0.14;
              const path = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
              const on = selected === d.id;
              const col = STATUS_COLOR[d.status] ?? GREEN;
              // courier position along the quadratic at t=progress
              const t = d.progress, it = 1 - t;
              const cx = it * it * x1 + 2 * it * t * mx + t * t * x2;
              const cy = it * it * y1 + 2 * it * t * my + t * t * y2;
              return (
                <g key={d.id} style={{ cursor: "pointer" }} onMouseEnter={() => onSelect(d.id)}>
                  <path d={path} fill="none" stroke={col} strokeOpacity={on ? 0.55 : 0.22} strokeWidth={on ? 0.9 : 0.5} strokeLinecap="round" />
                  <path d={path} fill="none" stroke={col} strokeOpacity={on ? 0.95 : 0.6} strokeWidth={on ? 0.7 : 0.4}
                    strokeLinecap="round" strokeDasharray="2 7"
                    style={{ animation: `lg-dash ${on ? 1.1 : 1.8}s linear infinite` }} />
                  {/* destination ping */}
                  <circle cx={x2} cy={y2} r={on ? 1.5 : 1} fill={col} filter="url(#lg-glow)" />
                  <circle cx={x2} cy={y2} r="1.2" fill="none" stroke={col} strokeWidth="0.3" opacity="0.6"
                    style={{ transformOrigin: `${x2}px ${y2}px`, animation: "lg-ping 2s ease-out infinite" }} />
                  {/* courier dot */}
                  <circle cx={cx} cy={cy} r={on ? 1.6 : 1.1} fill="#fff" filter="url(#lg-glow)" />
                  <circle cx={cx} cy={cy} r={on ? 1.6 : 1.1} fill={col} fillOpacity="0.5" />
                </g>
              );
            })}

            {/* cities */}
            {data.cities.map((c) => (
              <g key={c.name}>
                <circle cx={px(c.x)} cy={px(c.y)} r="0.9" fill={GREEN} fillOpacity="0.5" />
                <text x={px(c.x) + 1.6} y={px(c.y) + 0.8} fontSize="2.6" fill="#ffffff" fillOpacity="0.55" fontFamily="monospace">{c.name}</text>
              </g>
            ))}

            {/* hub */}
            <g>
              <circle cx={px(data.hub.x)} cy={px(data.hub.y)} r="2.4" fill="none" stroke={GREEN} strokeWidth="0.4"
                style={{ transformOrigin: `${px(data.hub.x)}px ${px(data.hub.y)}px`, animation: "lg-ping 2.4s ease-out infinite" }} />
              <circle cx={px(data.hub.x)} cy={px(data.hub.y)} r="1.6" fill={GREEN} filter="url(#lg-glow)" />
            </g>
          </svg>
        </div>
      </div>

      {/* legend */}
      <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-white/50">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: GREEN }} /> Hub</span>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[k] }} /> {v}</span>
        ))}
      </div>

      <style>{`
        @keyframes lg-dash { to { stroke-dashoffset: -18; } }
        @keyframes lg-ping { 0% { transform: scale(0.5); opacity: 0.9; } 100% { transform: scale(2.6); opacity: 0; } }
      `}</style>
    </div>
  );
}

/* ===================================================================== */
function DeliveryRow({ d, active, onHover }: { d: FleetDelivery; active: boolean; onHover: () => void }) {
  const col = STATUS_COLOR[d.status] ?? GREEN;
  const overdue = d.etaLeftMin < 0 && d.status !== "arrived";
  return (
    <Link href={`/admin/orders/${d.id}`} onMouseEnter={onHover}
      className="group block rounded-xl border p-3 transition"
      style={{ borderColor: active ? `${col}66` : "rgba(255,255,255,0.1)", background: active ? `${col}12` : "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${col}1f`, color: col }}>
          <Truck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
            #{d.id.slice(0, 8)} <span className="font-normal text-white/55"><User className="mb-0.5 inline h-3 w-3" /> @{d.buyer}</span>
          </p>
          <p className="flex items-center gap-1.5 truncate font-mono text-[10px] text-white/45">
            <MapPin className="h-3 w-3" />{d.region} · {d.distanceKm} km · {d.courierName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase" style={{ background: `${col}1f`, color: col }}>{STATUS_LABEL[d.status]}</span>
          <p className="mt-1 flex items-center justify-end gap-1 font-mono text-[10px]" style={{ color: overdue ? "#ef4444" : "rgba(255,255,255,0.55)" }}>
            <Clock className="h-3 w-3" />{fmtEta(d.etaLeftMin)}
          </p>
        </div>
      </div>
      {/* progress bar */}
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${Math.round(d.progress * 100)}%`, background: `linear-gradient(90deg,${col}66,${col})` }} />
      </div>
      <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-white/35">
        <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{d.courierPhone || "—"}</span>
        <span>{group(d.total)} смн</span>
      </div>
    </Link>
  );
}

function Tile({ label, value, accent, unit, Icon }: { label: string; value: number; accent: string; unit?: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
      </div>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </motion.div>
  );
}
