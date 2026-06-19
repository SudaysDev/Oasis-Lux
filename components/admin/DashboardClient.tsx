"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Activity,
  ArrowUpRight,
  Ban,
  Boxes,
  Crown,
  Megaphone,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Terminal,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  AreaChart,
  ConsoleFeed,
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
  StatusBars,
} from "./charts";
import type { AdminDashboard } from "@/lib/data/admin-stats";

/* ---------- shared card shell ---------- */
function Card({
  children,
  className = "",
  glow = "rgba(34,255,136,0.0)",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl ${className}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl" style={{ background: glow }} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Heading({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</p>
        <h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2>
      </div>
      {right}
    </div>
  );
}

/* ---------- KPI ---------- */
function Kpi({
  label,
  value,
  unit,
  Icon,
  href,
  accent,
  spark,
  delta,
  deltaUp = true,
}: {
  label: string;
  value: number;
  unit?: string;
  Icon: typeof Wallet;
  href: string;
  accent: string;
  spark?: number[];
  delta?: string;
  deltaUp?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <motion.div
        whileHover={{ y: -4 }}
        className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl transition group-hover:border-white/25"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-20 transition group-hover:opacity-50"
          style={{ background: accent }}
        />
        <div className="relative flex items-start justify-between">
          <motion.span
            className="grid h-11 w-11 place-items-center rounded-xl"
            style={{ background: `${accent}22`, color: accent }}
            animate={{ boxShadow: [`0 0 0px ${accent}00`, `0 0 16px ${accent}66`, `0 0 0px ${accent}00`] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className="h-5 w-5" />
          </motion.span>
          {spark && <LivePulse data={spark} color={accent} />}
        </div>
        <p className="relative mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-white/50">{label}</p>
        <p className="relative mt-1 text-[28px] font-black leading-none text-white">
          <CountUp value={value} />
          {unit && <span className="ml-1 text-base font-bold text-white/50">{unit}</span>}
        </p>
        {delta && (
          <p className="relative mt-2 flex items-center gap-1 text-[11px]" style={{ color: deltaUp ? accent : "#ef4444" }}>
            {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {delta}
          </p>
        )}
        <ArrowUpRight className="absolute bottom-4 right-4 h-4 w-4 text-white/20 transition group-hover:text-white/60" />
      </motion.div>
    </Link>
  );
}

const STATUS_COLOR: Record<string, string> = {
  placed: "#22ff88",
  processing: "#38bdf8",
  out_for_delivery: "#a78bfa",
  arrived: "#fbbf24",
  fulfilled: "#22c55e",
  cancelled: "#ef4444",
};

type TargetUser = { id: string; username: string; role: string; isAdmin: boolean };

export function DashboardClient({ data }: { data: AdminDashboard }) {
  const router = useRouter();
  const [target, setTarget] = useState<TargetUser | null>(null);
  const k = data.kpis;
  const inv = data.inventory;
  const inStockPct = inv.active ? Math.round(((inv.active - inv.out) / inv.active) * 100) : 0;
  const peakHour = data.byHour.indexOf(Math.max(0, ...data.byHour));

  const power = (label: string) =>
    toast(`${label} — wiring up in the next module.`, { icon: "⚡" });

  return (
    <div className="mx-auto max-w-6xl pb-10">
      {/* ---------------- header ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>
              Control Room
            </p>
            <LiveStatus />
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Admin overview</h1>
          <p className="mt-1.5 text-sm text-white/55">
            Full authority over the OASIS LUX grid — every metric below is live from the database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              router.refresh();
              toast.success("Grid refreshed");
            }}
            className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <Link
            href="/admin/stats"
            className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition hover:bg-white/5"
            style={{ borderColor: "rgba(34,255,136,0.35)", color: GREEN }}
          >
            Deep stats <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ---------------- KPI grid ---------------- */}
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total revenue"
          value={k.revenue}
          unit="смн"
          Icon={Wallet}
          href="/admin/stats"
          accent={GREEN}
          spark={data.revenue30d.map((p) => p.value)}
          delta={`${k.revenueGrowth >= 0 ? "+" : ""}${k.revenueGrowth}% vs prev 30d`}
          deltaUp={k.revenueGrowth >= 0}
        />
        <Kpi
          label="Accounts"
          value={k.users}
          Icon={Users}
          href="/admin/users"
          accent="#38bdf8"
          spark={data.signups30d.map((p) => p.value)}
          delta={`+${k.newUsers30d} new · ${k.userGrowth >= 0 ? "+" : ""}${k.userGrowth}%`}
          deltaUp={k.userGrowth >= 0}
        />
        <Kpi
          label="Pending orders"
          value={k.pendingOrders}
          Icon={ShoppingCart}
          href="/admin/logistics"
          accent="#fbbf24"
          spark={data.orders14d.map((p) => p.value)}
          delta={`${k.orders} orders total`}
        />
        <Kpi
          label="Live products"
          value={k.products}
          Icon={Boxes}
          href="/admin/products"
          accent="#a78bfa"
          delta={`${k.activePromos} active promos`}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallStat label="GMV (all time)" value={k.gmv} unit="смн" accent="#22ff88" />
        <SmallStat label="Avg order value" value={Math.round(k.avgOrder)} unit="смн" accent="#38bdf8" />
        <SmallStat label="Sellers" value={k.sellers} accent="#a78bfa" />
        <SmallStat label="Couriers" value={k.couriers} accent="#fbbf24" />
      </div>

      {/* ---------------- revenue + roles ---------------- */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(34,255,136,0.15)">
          <Heading
            kicker="30-day trend"
            title="Revenue flow"
            right={
              <span className="font-mono text-2xl font-black" style={{ color: GREEN }}>
                <CountUp value={k.revenue} /> <span className="text-sm text-white/40">смн</span>
              </span>
            }
          />
          <AreaChart data={data.revenue30d} unit=" смн" />
        </Card>
        <Card glow="rgba(167,139,250,0.15)">
          <Heading kicker="Population" title="Roles" />
          <Donut data={data.roles} />
        </Card>
      </div>

      {/* ---------------- signups bars + gauges + status ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(56,189,248,0.12)">
          <Heading kicker="Onboarding" title="Signups · 30d" />
          <MiniBars data={data.signups30d} color="#38bdf8" />
        </Card>
        <Card glow="rgba(34,255,136,0.12)">
          <Heading kicker="Performance" title="Health" />
          <div className="flex items-center justify-around">
            <RadialGauge value={k.fulfilledRate} label="Fulfilled" color={GREEN} />
            <RadialGauge value={k.cancelledRate} label="Cancelled" color="#ef4444" />
          </div>
        </Card>
        <Card glow="rgba(251,191,36,0.12)">
          <Heading kicker="Pipeline" title="Orders by status" />
          <StatusBars data={data.ordersByStatus} />
        </Card>
      </div>

      {/* ---------------- cumulative revenue + product mix ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(52,211,153,0.14)">
          <Heading
            kicker="Compounding"
            title="Cumulative revenue · 30d"
            right={
              <span className="font-mono text-xl font-black" style={{ color: "#34d399" }}>
                <CountUp value={k.gmv} /> <span className="text-xs text-white/40">смн GMV</span>
              </span>
            }
          />
          <AreaChart data={data.cumulative30d} color="#34d399" unit=" смн" />
        </Card>
        <Card glow="rgba(34,255,136,0.12)">
          <Heading kicker="Catalog" title="Product mix" />
          {data.productMix.length ? (
            <Donut data={data.productMix} />
          ) : (
            <Empty text="No products yet." />
          )}
        </Card>
      </div>

      {/* ---------------- regions + 24h activity + inventory ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card glow="rgba(56,189,248,0.12)">
          <Heading kicker="Geography" title="Revenue by region" />
          <HBars data={data.byRegion} suffix=" смн" />
        </Card>
        <Card glow="rgba(167,139,250,0.12)">
          <Heading kicker="Rhythm" title="Activity · by hour" />
          <Heat data={data.byHour} labels={HOURS} color="#a78bfa" />
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-white/35">
            Peak hour · {peakHour}:00 — {group(Math.max(0, ...data.byHour))} orders
          </p>
        </Card>
        <Card glow="rgba(251,191,36,0.12)">
          <Heading kicker="Warehouse" title="Inventory health" />
          <div className="flex items-center gap-5">
            <RadialGauge value={inStockPct} label="In stock" color="#fbbf24" />
            <div className="flex-1 space-y-2.5">
              <InvRow label="Units in stock" value={data.inventory.totalStock} color={GREEN} />
              <InvRow label="Active products" value={data.inventory.active} color="#38bdf8" />
              <InvRow label="Low stock (≤3)" value={data.inventory.low} color="#fbbf24" />
              <InvRow label="Out of stock" value={data.inventory.out} color="#ef4444" />
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- console + power actions ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(34,255,136,0.1)">
          <Heading
            kicker="Live feed"
            title="System console"
            right={
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
                <Activity className="h-3.5 w-3.5" style={{ color: GREEN }} /> streaming
              </span>
            }
          />
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <ConsoleFeed lines={data.recentActivity} />
          </div>
        </Card>

        <Card glow="rgba(239,68,68,0.12)">
          <Heading kicker="Authority" title="Power actions" />
          <div className="grid grid-cols-2 gap-2.5">
            <PowerBtn Icon={Ticket} label="New promo" href="/admin/promo" accent={GREEN} />
            <PowerBtn Icon={Package} label="Add product" href="/admin/products" accent="#a78bfa" />
            <PowerBtn Icon={Terminal} label="Console" href="/admin/control" accent="#38bdf8" />
            <PowerBtn Icon={Users} label="Users" href="/admin/users" accent="#fbbf24" />
            <button
              onClick={() => power("Broadcast")}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5"
            >
              <Megaphone className="h-4 w-4" /> Broadcast to all users
            </button>
            <div
              className="col-span-2 mt-1 flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed"
              style={{ borderColor: "rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.06)" }}
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#a78bfa]" />
              <span className="text-white/65">
                Two admins run this grid. <strong className="text-white">Admins are protected</strong> — you
                can&apos;t ban, restrict or remove a fellow admin.
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- top products + spenders ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,255,136,0.1)">
          <Heading
            kicker="Best sellers"
            title="Top products"
            right={
              <Link href="/admin/products" className="text-xs text-white/50 transition hover:text-white">
                Inventory →
              </Link>
            }
          />
          <div className="no-scrollbar max-h-[340px] space-y-2 overflow-y-auto">
            {data.topProducts.length === 0 && <Empty text="No sales recorded yet." />}
            {data.topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg font-mono text-xs font-bold" style={{ background: `${GREEN}1f`, color: GREEN }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{p.title}</p>
                  <p className="font-mono text-[10px] text-white/45">{p.qty} sold</p>
                </div>
                <span className="font-mono text-sm font-bold text-white">{group(p.revenue)} смн</span>
              </div>
            ))}
          </div>
        </Card>

        <Card glow="rgba(251,191,36,0.1)">
          <Heading
            kicker="Whales"
            title="Top spenders"
            right={<Trophy className="h-4 w-4 text-[#fbbf24]" />}
          />
          <div className="no-scrollbar max-h-[340px] space-y-2 overflow-y-auto">
            {data.topSpenders.length === 0 && <Empty text="No spend recorded yet." />}
            {data.topSpenders.map((u, i) => (
              <button
                key={u.id}
                onClick={() => setTarget(u)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left transition hover:border-white/20"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                    @{u.username}
                    {u.isAdmin && <Crown className="h-3.5 w-3.5 text-[#a78bfa]" />}
                  </p>
                  <p className="font-mono text-[10px] uppercase text-white/45">{u.role}</p>
                </div>
                <span className="font-mono text-sm font-bold text-white">{group(u.total)} смн</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- promos + recent orders ---------------- */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(56,189,248,0.1)">
          <Heading
            kicker="Active"
            title="Promo codes"
            right={
              <Link href="/admin/promo" className="text-xs text-white/50 transition hover:text-white">
                Engine →
              </Link>
            }
          />
          <div className="no-scrollbar grid max-h-[340px] gap-2.5 overflow-y-auto sm:grid-cols-2">
            {data.promos.length === 0 && <Empty text="No active promo codes." />}
            {data.promos.map((p) => (
              <div key={p.code} className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-black tracking-wider" style={{ color: GREEN }}>
                    {p.code}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] uppercase text-white/60">
                    {p.type}
                  </span>
                </div>
                <p className="mt-1 text-lg font-black text-white">
                  {p.type === "percent" ? `${p.value}%` : `${group(p.value)} смн`}
                </p>
                <p className="truncate text-[11px] text-white/45">{p.label} · used {p.used}×</p>
              </div>
            ))}
          </div>
        </Card>

        <Card glow="rgba(34,197,94,0.1)">
          <Heading
            kicker="Live feed"
            title="Recent orders"
            right={
              <Link href="/admin/logistics" className="text-xs text-white/50 transition hover:text-white">
                Logistics →
              </Link>
            }
          />
          <div className="no-scrollbar max-h-[340px] divide-y divide-white/5 overflow-y-auto">
            {data.recentOrders.length === 0 && <Empty text="No orders yet — the grid is quiet." />}
            {data.recentOrders.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{r.full_name || "—"}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/40">#{r.id.slice(0, 8)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-white">{group(r.total)} смн</span>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase"
                    style={{ background: `${STATUS_COLOR[r.status] ?? "#888"}1f`, color: STATUS_COLOR[r.status] ?? "#888" }}
                  >
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- user action modal ---------------- */}
      <AnimatePresence>
        {target && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTarget(null)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#0a0e16] p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full text-sm font-black" style={{ background: `${GREEN}1f`, color: GREEN }}>
                    {target.username.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="flex items-center gap-1.5 font-bold text-white">
                      @{target.username}
                      {target.isAdmin && <Crown className="h-4 w-4 text-[#a78bfa]" />}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">{target.role}</p>
                  </div>
                </div>
                <button onClick={() => setTarget(null)} className="text-white/40 transition hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {target.isAdmin ? (
                <div
                  className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed"
                  style={{ borderColor: "rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.08)" }}
                >
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#a78bfa]" />
                  <span className="text-white/75">
                    This is a protected <strong className="text-white">admin</strong> account. Admins can&apos;t be
                    banned, restricted, edited or removed by another admin.
                  </span>
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                <Link
                  href={`/admin/users?id=${target.id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"
                >
                  <UserCog className="h-4 w-4 text-white/70" /> Open dossier
                </Link>
                <ModalAction
                  Icon={SlidersHorizontal}
                  label="Restrict (brand / sell / chat)"
                  disabled={target.isAdmin}
                  onClick={() => {
                    setTarget(null);
                    toast("Restriction tools land in the Black List module.", { icon: "🛡️" });
                  }}
                />
                <ModalAction
                  Icon={Ban}
                  label="Ban account"
                  danger
                  disabled={target.isAdmin}
                  onClick={() => {
                    setTarget(null);
                    toast("Ban controls go live with the Full Control console.", { icon: "⛔" });
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- small pieces ---------- */
function SmallStat({ label, value, unit, accent }: { label: string; value: number; unit?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">
        <CountUp value={value} />
        {unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}
      </p>
    </div>
  );
}

function PowerBtn({ Icon, label, href, accent }: { Icon: typeof Ticket; label: string; href: string; accent: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-white/10 px-3 py-4 text-center transition hover:bg-white/5"
      style={{ boxShadow: `inset 0 0 0 1px transparent` }}
    >
      <Icon className="h-5 w-5" style={{ color: accent }} />
      <span className="text-xs font-semibold text-white/85">{label}</span>
    </Link>
  );
}

function ModalAction({
  Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  Icon: typeof Ban;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Admins are protected" : undefined}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
        disabled
          ? "cursor-not-allowed border-white/5 text-white/30"
          : danger
            ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
            : "border-white/10 text-white hover:bg-white/5"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
      {disabled && <ShieldCheck className="ml-auto h-4 w-4 text-[#a78bfa]" />}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-white/40">{text}</p>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${i}:00`);

function InvRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-white/70">
        <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        {label}
      </span>
      <span className="font-mono font-bold text-white">
        <CountUp value={value} />
      </span>
    </div>
  );
}
