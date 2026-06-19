"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Activity,
  Banknote,
  BarChart3,
  Boxes,
  CalendarDays,
  Clock,
  Coins,
  Crown,
  Gauge,
  Layers,
  MapPin,
  Package,
  Percent,
  Repeat,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Tag,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  AreaChart,
  CountUp,
  Donut,
  Funnel,
  GREEN,
  group,
  HBars,
  Heat,
  LivePulse,
  LiveStatus,
  MiniBars,
  RadialGauge,
} from "./charts";
import type { AdminStatistics, Point } from "@/lib/data/admin-stats";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

function Card({ children, className = "", glow = "rgba(34,255,136,0)" }: { children: React.ReactNode; className?: string; glow?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl ${className}`}>
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: glow }} />
      <div className="relative">{children}</div>
    </div>
  );
}
function Heading({ kicker, title, Icon, right }: { kicker: string; title: string; Icon?: typeof BarChart3; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4" style={{ color: GREEN }} />}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</p>
          <h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2>
        </div>
      </div>
      {right}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-9 flex items-center gap-3">
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg,transparent,rgba(34,255,136,0.4))" }} />
      <span className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>
        {children}
      </span>
      <span className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(34,255,136,0.4),transparent)" }} />
    </div>
  );
}
function Stat({ label, value, unit, accent = GREEN }: { label: string; value: number; unit?: string; accent?: string }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">
        <CountUp value={value} />
        {unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}
      </p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </motion.div>
  );
}
function Growth({ label, value }: { label: string; value: number }) {
  const up = value >= 0;
  return (
    <span
      className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[11px]"
      style={{ borderColor: up ? "rgba(34,255,136,0.3)" : "rgba(239,68,68,0.3)", color: up ? GREEN : "#ef4444" }}
    >
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {label} {up ? "+" : ""}{value}%
    </span>
  );
}

function MetricExplorer({ revenue, orders, signups }: { revenue: Point[]; orders: Point[]; signups: Point[] }) {
  const [metric, setMetric] = useState<"revenue" | "orders" | "signups">("revenue");
  const [range, setRange] = useState<number>(30);
  const series = metric === "revenue" ? revenue : metric === "orders" ? orders : signups;
  const sliced = series.slice(Math.max(0, series.length - range));
  const color = metric === "revenue" ? GREEN : metric === "orders" ? "#38bdf8" : "#a78bfa";
  const total = sliced.reduce((a, b) => a + b.value, 0);
  const peak = Math.max(0, ...sliced.map((s) => s.value));
  const unit = metric === "revenue" ? " смн" : "";
  const METRICS = [
    { id: "revenue", label: "Revenue", Icon: Banknote },
    { id: "orders", label: "Orders", Icon: ShoppingBag },
    { id: "signups", label: "Signups", Icon: Users },
  ] as const;
  return (
    <Card className="mt-5" glow={`${color}22`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          {METRICS.map(({ id, label, Icon }) => {
            const on = metric === id;
            return (
              <button key={id} onClick={() => setMetric(id)} className="relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold">
                {on && <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-lg" style={{ background: `${color}22`, boxShadow: `inset 0 0 0 1px ${color}66` }} transition={{ type: "spring", stiffness: 350, damping: 30 }} />}
                <Icon className="relative z-10 h-3.5 w-3.5" style={{ color: on ? color : "rgba(255,255,255,0.55)" }} />
                <span className="relative z-10" style={{ color: on ? color : "rgba(255,255,255,0.6)" }}>{label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
          {[7, 30, 90].map((r) => {
            const on = range === r;
            return (
              <button key={r} onClick={() => setRange(r)} className="relative rounded-lg px-3 py-2 font-mono text-xs font-semibold">
                {on && <motion.span layoutId="range-pill" className="absolute inset-0 rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }} transition={{ type: "spring", stiffness: 350, damping: 30 }} />}
                <span className="relative z-10" style={{ color: on ? "white" : "rgba(255,255,255,0.5)" }}>{r}d</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">{range}-day total</p>
          <p className="text-3xl font-black text-white">
            <CountUp value={total} />
            {unit && <span className="ml-1 text-base text-white/40">{unit.trim()}</span>}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Peak day</p>
          <p className="text-xl font-bold" style={{ color }}>
            {group(peak)}
            {unit}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 self-center">
          <LivePulse data={sliced.map((s) => s.value)} color={color} />
        </div>
      </div>
      <AreaChart key={`${metric}-${range}`} data={sliced} color={color} unit={unit} height={230} />
    </Card>
  );
}

function Callout({ Icon, label, value, accent }: { Icon: typeof Coins; label: string; value: string; accent: string }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${accent}22`, color: accent }}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
        <p className="truncate text-lg font-black text-white">{value}</p>
      </div>
    </motion.div>
  );
}

export function StatisticsClient({ data }: { data: AdminStatistics }) {
  const router = useRouter();
  const t = data.totals;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>
              Statistics
            </p>
            <LiveStatus />
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Everything, measured</h1>
          <p className="mt-1.5 text-sm text-white/55">
            Every number the grid produces — money, audience, catalog and operations — live from the database.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Growth label="Revenue" value={data.growth.revenue} />
            <Growth label="Users" value={data.growth.users} />
            <Growth label="Orders" value={data.growth.orders} />
          </div>
        </div>
        <button
          onClick={() => {
            router.refresh();
            toast.success("Statistics refreshed");
          }}
          className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/5"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* interactive metric explorer */}
      <MetricExplorer revenue={data.revenue90d} orders={data.orders90d} signups={data.signups90d} />

      {/* quick callouts */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Callout Icon={ShoppingBag} label="Items / order" value={String(data.extras.avgItemsPerOrder)} accent="#38bdf8" />
        <Callout Icon={Percent} label="Top-5 revenue share" value={`${data.extras.revenueConcentration}%`} accent={GREEN} />
        <Callout Icon={Clock} label="Peak hour" value={`${data.extras.bestHour}:00`} accent="#a78bfa" />
        <Callout Icon={CalendarDays} label="Best day" value={data.extras.bestDay} accent="#fbbf24" />
        <Callout Icon={Repeat} label="Repeat buyers" value={String(data.extras.repeatBuyers)} accent="#34d399" />
        <Callout Icon={Coins} label="Promo uses" value={String(data.extras.promoRedemptions)} accent="#fb7185" />
      </div>

      {/* ============================= MONEY ============================= */}
      <SectionTitle>Money</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Revenue" value={t.revenue} unit="смн" />
        <Stat label="GMV" value={t.gmv} unit="смн" accent="#34d399" />
        <Stat label="Orders" value={t.orders} accent="#38bdf8" />
        <Stat label="Avg order" value={t.avgOrder} unit="смн" accent="#a78bfa" />
        <Stat label="Fulfilled" value={t.fulfilled} accent="#22c55e" />
        <Stat label="Cancelled" value={t.cancelled} accent="#ef4444" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(34,255,136,0.14)">
          <Heading
            kicker="90-day trend"
            title="Revenue flow"
            Icon={Banknote}
            right={
              <span className="flex items-center gap-3">
                <LivePulse data={data.revenue90d.map((p) => p.value)} />
                <span className="font-mono text-xl font-black" style={{ color: GREEN }}>
                  <CountUp value={t.revenue} /> <span className="text-xs text-white/40">смн</span>
                </span>
              </span>
            }
          />
          <AreaChart data={data.revenue90d} unit=" смн" height={210} />
        </Card>
        <Card glow="rgba(52,211,153,0.14)">
          <Heading kicker="Conversion" title="Order funnel" Icon={Gauge} />
          <Funnel data={data.statusFunnel} />
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
            <span className="text-sm text-white/60">Placed → Fulfilled</span>
            <span className="font-mono text-lg font-black" style={{ color: GREEN }}>
              <CountUp value={t.conversion} />%
            </span>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(52,211,153,0.12)">
          <Heading kicker="Compounding" title="Cumulative revenue · 90d" Icon={TrendingUp} />
          <AreaChart data={data.cumulative90d} color="#34d399" unit=" смн" height={180} />
        </Card>
        <Card glow="rgba(167,139,250,0.12)">
          <Heading kicker="Trend" title="Avg order value · 30d" Icon={Activity} />
          <MiniBars data={data.aov30d} color="#a78bfa" height={170} />
        </Card>
      </div>

      {/* =========================== AUDIENCE =========================== */}
      <SectionTitle>Audience</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={t.users} accent="#38bdf8" />
        <Stat label="Buyers" value={t.buyers} />
        <Stat label="Sellers" value={t.sellers} accent="#a78bfa" />
        <Stat label="Couriers" value={t.couriers} accent="#fbbf24" />
        <Stat label="Verified" value={t.verified} accent="#34d399" />
        <Stat label="Reviews" value={t.reviews} accent="#fb7185" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(56,189,248,0.12)">
          <Heading kicker="Population" title="Roles" Icon={Users} />
          <HBars data={data.roles.map((b, i) => ({ ...b, color: ["#22ff88", "#38bdf8", "#fbbf24", "#a78bfa"][i % 4] }))} />
        </Card>
        <Card glow="rgba(167,139,250,0.12)">
          <Heading kicker="Monetisation" title="Plans" Icon={Star} />
          <HBars data={data.plans} />
        </Card>
        <Card glow="rgba(251,191,36,0.12)">
          <Heading kicker="Loyalty" title="Tiers" Icon={Crown} />
          <HBars data={data.tiers} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,255,136,0.1)">
          <Heading kicker="New users · 90d" title="Signups" Icon={Users} />
          <MiniBars data={data.signups90d} color="#38bdf8" height={150} />
        </Card>
        <Card glow="rgba(56,189,248,0.1)">
          <Heading kicker="Orders · 90d" title="Order volume" Icon={BarChart3} />
          <MiniBars data={data.orders90d} color={GREEN} height={150} />
        </Card>
      </div>

      {/* =========================== BEHAVIOUR =========================== */}
      <SectionTitle>Behaviour</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(34,255,136,0.12)">
          <Heading kicker="Retention" title="Buyer loyalty" Icon={Repeat} />
          {data.buyerLoyalty.some((d) => d.value) ? <Donut data={data.buyerLoyalty} /> : <p className="text-sm text-white/40">No buyers yet.</p>}
        </Card>
        <Card glow="rgba(52,211,153,0.12)">
          <Heading kicker="Trust" title="Verified accounts" Icon={ShieldCheck} />
          {data.verifiedSplit.some((d) => d.value) ? <Donut data={data.verifiedSplit} /> : <p className="text-sm text-white/40">No accounts yet.</p>}
        </Card>
        <Card glow="rgba(251,113,133,0.12)">
          <Heading kicker="Catalog status" title="Active vs inactive" Icon={Boxes} />
          {data.activeSplit.some((d) => d.value) ? <Donut data={data.activeSplit} /> : <p className="text-sm text-white/40">No products yet.</p>}
        </Card>
      </div>

      {/* =========================== RHYTHM =========================== */}
      <SectionTitle>Rhythm</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(167,139,250,0.12)">
          <Heading kicker="When orders happen" title="Activity by hour" Icon={Clock} />
          <Heat data={data.byHour} labels={HOURS} color="#a78bfa" />
          <div className="mt-2 flex justify-between font-mono text-[9px] text-white/30">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </Card>
        <Card glow="rgba(34,255,136,0.12)">
          <Heading kicker="Weekly shape" title="By weekday" Icon={CalendarDays} />
          <Heat data={data.byWeekday} labels={WEEKDAYS} color={GREEN} />
          <div className="mt-2 flex justify-between font-mono text-[9px] text-white/30">
            {WEEKDAYS.map((w) => (
              <span key={w}>{w[0]}</span>
            ))}
          </div>
        </Card>
      </div>

      {/* ====================== CATALOG & INVENTORY ====================== */}
      <SectionTitle>Catalog &amp; Inventory</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Products" value={t.products} accent="#a78bfa" />
        <Stat label="Active" value={t.activeProducts} />
        <Stat label="Units stock" value={t.totalStock} accent="#38bdf8" />
        <Stat label="Low stock" value={t.lowStock} accent="#fbbf24" />
        <Stat label="Out of stock" value={t.outOfStock} accent="#ef4444" />
        <Stat label="Avg rating" value={t.avgRating} unit="★" accent="#fbbf24" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(34,255,136,0.12)">
          <Heading kicker="Mix" title="Product types" Icon={Layers} />
          {data.productTypes.length ? <Donut data={data.productTypes} /> : <p className="text-sm text-white/40">No products yet.</p>}
        </Card>
        <Card glow="rgba(56,189,248,0.12)">
          <Heading kicker="Taxonomy" title="Top categories" Icon={Tag} />
          <HBars data={data.categories} />
        </Card>
        <Card glow="rgba(251,191,36,0.12)">
          <Heading kicker="Labels" title="Top brands" Icon={Package} />
          <HBars data={data.brands} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(167,139,250,0.1)">
          <Heading kicker="Quality" title="Condition" Icon={Boxes} />
          <HBars data={data.conditions} />
        </Card>
        <Card glow="rgba(251,191,36,0.1)">
          <Heading kicker="Capital" title="Listed value" Icon={Banknote} />
          <div className="flex h-full flex-col items-center justify-center py-4 text-center">
            <p className="text-4xl font-black text-white">
              <CountUp value={t.listedValue} />
            </p>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest" style={{ color: GREEN }}>
              смн in active stock
            </p>
          </div>
        </Card>
        <Card glow="rgba(34,255,136,0.1)">
          <Heading kicker="Geography" title="Revenue by region" Icon={MapPin} />
          <HBars data={data.regions} suffix=" смн" />
        </Card>
      </div>

      {/* ========================= DISTRIBUTIONS ========================= */}
      <SectionTitle>Distributions</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(34,255,136,0.1)">
          <Heading kicker="Pricing" title="Price distribution" Icon={Banknote} />
          <Hist data={data.priceBuckets} color={GREEN} />
        </Card>
        <Card glow="rgba(251,191,36,0.1)">
          <Heading kicker="Quality" title="Rating distribution" Icon={Star} />
          <Hist data={data.ratingBuckets} color="#fbbf24" />
        </Card>
        <Card glow="rgba(56,189,248,0.1)">
          <Heading kicker="Warehouse" title="Stock distribution" Icon={Boxes} />
          <Hist data={data.stockBuckets} color="#38bdf8" />
        </Card>
      </div>

      {/* ======================== LEADERBOARDS ======================== */}
      <SectionTitle>Leaderboards</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-3">
        <Leaderboard title="Top sellers" Icon={Trophy} rows={data.topSellers.map((s) => ({ id: s.id, name: `@${s.username}`, isAdmin: s.isAdmin, value: `${group(s.revenue)} смн`, sub: `${s.orders} orders` }))} />
        <Leaderboard title="Top products" Icon={Package} rows={data.topProducts.map((p) => ({ id: p.id, name: p.title, value: `${group(p.revenue)} смн`, sub: `${p.qty} sold` }))} />
        <Leaderboard title="Top spenders" Icon={Crown} rows={data.topSpenders.map((s) => ({ id: s.id, name: `@${s.username}`, isAdmin: s.isAdmin, value: `${group(s.total)} смн`, sub: "" }))} />
      </div>

      {/* promos */}
      <SectionTitle>Promotions</SectionTitle>
      <Card glow="rgba(56,189,248,0.1)">
        <Heading kicker="Active" title="Promo code usage" Icon={Tag} right={<RadialGauge value={Math.min(100, t.promos * 10)} label="Active" color="#38bdf8" />} />
        <div className="no-scrollbar grid max-h-[460px] gap-2.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {data.promos.length === 0 && <p className="text-sm text-white/40">No active promo codes.</p>}
          {data.promos.map((p) => (
            <div key={p.code} className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-black tracking-wider" style={{ color: GREEN }}>{p.code}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] uppercase text-white/60">{p.type}</span>
              </div>
              <p className="mt-1 text-lg font-black text-white">{p.type === "percent" ? `${p.value}%` : `${group(p.value)} смн`}</p>
              <p className="truncate text-[11px] text-white/45">{p.label} · used {p.used}×</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Hist({ data, color }: { data: Point[]; color: string }) {
  return (
    <div>
      <MiniBars data={data} color={color} height={140} />
      <div className="mt-2 flex gap-1">
        {data.map((d) => (
          <span key={d.label} className="flex-1 truncate text-center font-mono text-[9px] text-white/40">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Leaderboard({
  title,
  Icon,
  rows,
}: {
  title: string;
  Icon: typeof Trophy;
  rows: { id: string; name: string; value: string; sub: string; isAdmin?: boolean }[];
}) {
  return (
    <Card glow="rgba(251,191,36,0.1)">
      <Heading kicker="Ranking" title={title} Icon={Icon} />
      <div className="no-scrollbar max-h-[420px] space-y-2 overflow-y-auto">
        {rows.length === 0 && <p className="py-4 text-center text-sm text-white/40">No data yet.</p>}
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold"
              style={{ background: i === 0 ? "rgba(251,191,36,0.2)" : `${GREEN}1f`, color: i === 0 ? "#fbbf24" : GREEN }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                {r.name}
                {r.isAdmin && <Crown className="h-3.5 w-3.5 text-[#a78bfa]" />}
              </p>
              {r.sub && <p className="font-mono text-[10px] text-white/45">{r.sub}</p>}
            </div>
            <span className="shrink-0 font-mono text-sm font-bold text-white">{r.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
