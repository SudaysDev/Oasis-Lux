"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft, BadgePercent, Coins, Copy, Eye, EyeOff, Loader2, RotateCcw, Save, Ticket, Trash2, Users, Wallet,
} from "lucide-react";
import { AreaChart, CountUp, GREEN, group, HBars, LiveStatus } from "./charts";
import { Select } from "./Select";
import { deletePromo, resetPromoUsage, togglePromo, updatePromo, type ActionResult } from "@/app/(admin)/admin/promo/actions";
import type { AdminPromoDossier } from "@/lib/data/admin-promo";

const TYPE_COLOR: Record<string, string> = { percent: "#22ff88", fixed: "#38bdf8", cashback: "#a78bfa" };
const STATUS_COLOR: Record<string, string> = { active: "#22ff88", scheduled: "#38bdf8", expired: "#fbbf24", maxed: "#fb7185", disabled: "#64748b" };
const ORDER_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#22c55e", cancelled: "#ef4444" };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const valueLabel = (t: string, v: number) => (t === "percent" ? `${v}%` : t === "cashback" ? `${v}% back` : `${group(v)} смн`);
const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

export function PromoDossierClient({ d }: { d: AdminPromoDossier }) {
  const router = useRouter();
  const p = d.promo;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const [type, setType] = useState(p.type);
  const [value, setValue] = useState(String(p.value));
  const [scope, setScope] = useState(p.scope);
  const [scopeRef, setScopeRef] = useState(p.scopeRef ?? "");
  const [scopeLabel, setScopeLabel] = useState(p.scopeLabel ?? "");
  const [minOrder, setMinOrder] = useState(p.minOrder != null ? String(p.minOrder) : "");
  const [maxDiscount, setMaxDiscount] = useState(p.maxDiscount != null ? String(p.maxDiscount) : "");
  const [usageLimit, setUsageLimit] = useState(p.usageLimit != null ? String(p.usageLimit) : "");
  const [expiresAt, setExpiresAt] = useState(p.expiresAt ? p.expiresAt.slice(0, 10) : "");

  const run = (fn: () => Promise<ActionResult>, ok = "Saved") => {
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(ok); router.refresh(); }
    });
  };
  const save = () => run(() => updatePromo(p.id, {
    type, value: Number(value) || 0, scope,
    scope_ref: scope === "all" ? null : scopeRef || null, scope_label: scopeLabel.trim() || null,
    min_order: minOrder ? Number(minOrder) : null, max_discount: maxDiscount ? Number(maxDiscount) : null,
    usage_limit: usageLimit ? Number(usageLimit) : null, expires_at: expiresAt || null,
  }), "Promo updated");

  const TypeIcon = p.type === "cashback" ? Coins : p.type === "fixed" ? Wallet : BadgePercent;

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/admin/promo" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to promo codes</Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block"><LiveStatus /></span>
          <button onClick={() => run(() => togglePromo(p.id, !p.isActive), p.isActive ? "Disabled" : "Enabled")} disabled={busy} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition" style={p.isActive ? { borderColor: `${GREEN}55`, color: GREEN } : { borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}>
            {p.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {p.isActive ? "Active" : "Disabled"}
          </button>
          <button onClick={() => setConfirm(true)} className="flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>

      {/* header */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6" style={{ background: `linear-gradient(120deg,${TYPE_COLOR[p.type]}1f,#0a0e16)` }}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: `${TYPE_COLOR[p.type]}22`, color: TYPE_COLOR[p.type] }}><TypeIcon className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-3 font-mono text-3xl font-black tracking-wide text-white">
              {p.code}
              <button onClick={() => { navigator.clipboard?.writeText(p.code); toast.success("Copied"); }} className="text-white/40 transition hover:text-white"><Copy className="h-4 w-4" /></button>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge color={TYPE_COLOR[p.type]}>{valueLabel(p.type, p.value)} · {p.type}</Badge>
              <Badge color="#38bdf8">{p.scopeLabel || p.scope}</Badge>
              <Badge color={STATUS_COLOR[p.status]}>{p.status}</Badge>
              {p.aiGenerated && <Badge color="#a78bfa">AI</Badge>}
              <span className="font-mono text-[11px] text-white/40">created {fmtDate(p.createdAt)}{p.expiresAt ? ` · ends ${fmtDate(p.expiresAt)}` : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Redemptions" value={d.stats.redemptions + d.stats.orders} accent="#a78bfa" Icon={Ticket} />
        <Stat label="Unique users" value={d.stats.uniqueUsers} accent="#38bdf8" Icon={Users} />
        <Stat label="Given away" value={d.stats.discountGiven} unit="смн" Icon={Wallet} />
        <Stat label="Avg discount" value={d.stats.avgDiscount} unit="смн" accent="#34d399" />
        <Stat label="Uses left" value={d.stats.remaining ?? 0} accent={p.usageLimit ? "#fbbf24" : "#64748b"} />
        <Stat label="Days left" value={d.stats.daysLeft ?? 0} accent="#fb7185" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(167,139,250,0.12)">
          <CardHead kicker="30-day" title="Redemptions" />
          <AreaChart data={d.redeem30d} color="#a78bfa" />
        </Card>
        <Card glow="rgba(56,189,248,0.12)">
          <CardHead kicker="Where" title="By context" />
          <HBars data={d.byContext.map((c) => ({ label: c.context, value: c.count }))} />
        </Card>
      </div>

      {/* redeemers + orders */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,197,94,0.1)">
          <CardHead kicker="People" title="Recent redemptions" />
          <div className="no-scrollbar max-h-[320px] divide-y divide-white/5 overflow-y-auto">
            {d.recent.length === 0 && <Empty text="No redemptions yet." />}
            {d.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">{r.userId ? <Link href={`/admin/users/${r.userId}`} className="truncate text-sm text-white hover:underline">@{r.user}</Link> : <span className="text-sm text-white/60">@{r.user}</span>}<p className="font-mono text-[10px] text-white/40">{fmtDate(r.created_at)}</p></div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/60">{r.context}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card glow="rgba(251,191,36,0.1)">
          <CardHead kicker="Top" title="Heaviest redeemers" />
          <div className="no-scrollbar max-h-[320px] space-y-2 overflow-y-auto">
            {d.topRedeemers.length === 0 && <Empty text="Nobody yet." />}
            {d.topRedeemers.map((u, i) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 transition hover:border-white/20">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold" style={{ background: `${GREEN}1f`, color: GREEN }}>{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">@{u.username}</span>
                <span className="font-mono text-sm font-bold text-white">{u.count}×</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* orders that used it */}
      <Card className="mt-4" glow="rgba(34,255,136,0.1)">
        <CardHead kicker="Checkout" title="Orders using this code" />
        <div className="no-scrollbar max-h-[320px] divide-y divide-white/5 overflow-y-auto">
          {d.ordersList.length === 0 && <Empty text="No orders used this code." />}
          {d.ordersList.map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-80">
              <div className="min-w-0"><p className="truncate text-sm text-white">@{o.buyer} · #{o.id.slice(0, 8)}</p><p className="font-mono text-[10px] text-white/40">{fmtDate(o.created_at)} · −{group(o.discount)} смн</p></div>
              <div className="flex items-center gap-2"><span className="font-mono text-sm text-white">{group(o.total)} смн</span><span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${ORDER_COLOR[o.status] ?? "#888"}1f`, color: ORDER_COLOR[o.status] ?? "#888" }}>{o.status.replace(/_/g, " ")}</span></div>
            </Link>
          ))}
        </div>
      </Card>

      {/* editor */}
      <SectionTitle>Edit promo · full control</SectionTitle>
      <Card glow="rgba(167,139,250,0.12)">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Type"><Select value={type} onChange={setType} options={[{ value: "percent", label: "Percent off" }, { value: "fixed", label: "Fixed сомонӣ off" }, { value: "cashback", label: "Cashback %" }]} className="w-full" align="left" /></Field>
          <Field label={type === "fixed" ? "Amount · смн" : "Percent · %"}><input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls} /></Field>
          <Field label="Scope"><Select value={scope} onChange={(v) => { setScope(v); if (v === "all") setScopeRef(""); }} options={[{ value: "all", label: "Everything" }, { value: "brand", label: "A brand" }, { value: "category", label: "A category" }, { value: "product", label: "A product (id)" }]} className="w-full" align="left" /></Field>
          {scope === "brand" && <Field label="Brand"><Select value={scopeRef || "—"} onChange={(v) => setScopeRef(v === "—" ? "" : v)} options={[{ value: "—", label: "Pick a brand" }, ...d.taxonomy.brands.map((b) => ({ value: b, label: b }))]} className="w-full" align="left" /></Field>}
          {scope === "category" && <Field label="Category"><Select value={scopeRef || "—"} onChange={(v) => setScopeRef(v === "—" ? "" : v)} options={[{ value: "—", label: "Pick a category" }, ...d.taxonomy.categories.map((c) => ({ value: c.slug, label: c.label }))]} className="w-full" align="left" /></Field>}
          {scope === "product" && <Field label="Product ID"><input value={scopeRef} onChange={(e) => setScopeRef(e.target.value)} className={`${inputCls} font-mono`} /></Field>}
          <Field label="Scope label"><input value={scopeLabel} onChange={(e) => setScopeLabel(e.target.value)} className={inputCls} /></Field>
          <Field label="Min order · смн"><input value={minOrder} onChange={(e) => setMinOrder(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} /></Field>
          <Field label="Max discount · смн"><input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} /></Field>
          <Field label="Usage limit"><input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="unlimited" className={inputCls} /></Field>
          <Field label="Expires"><input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-white/40">Used {p.usedCount}× · <button onClick={() => run(() => resetPromoUsage(p.id), "Usage reset")} className="inline-flex items-center gap-1 text-amber-300 hover:underline"><RotateCcw className="h-3 w-3" /> reset counter</button></p>
          <div className="flex gap-3">
            <button onClick={() => router.refresh()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5">Reset</button>
            <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(false)}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0a0e16] p-5">
              <p className="flex items-center gap-2 font-bold text-white"><Trash2 className="h-5 w-5 text-red-400" /> Delete {p.code}?</p>
              <p className="mt-2 text-sm text-white/60">The code stops working immediately. Redemption history is kept. This can&apos;t be undone.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setConfirm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5">Cancel</button>
                <button onClick={() => startTransition(() => deletePromo(p.id))} className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/30">Delete forever</button>
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
function CardHead({ kicker, title }: { kicker: string; title: string }) {
  return <div className="mb-4"><p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{kicker}</p><h2 className="mt-0.5 text-lg font-bold text-white">{title}</h2></div>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-9 flex items-center gap-3"><span className="h-px flex-1" style={{ background: "linear-gradient(90deg,transparent,rgba(34,255,136,0.4))" }} /><span className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>{children}</span><span className="h-px flex-1" style={{ background: "linear-gradient(90deg,rgba(34,255,136,0.4),transparent)" }} /></div>;
}
function Stat({ label, value, unit, accent = GREEN, Icon }: { label: string; value: number; unit?: string; accent?: string; Icon?: typeof Wallet }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between"><p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>{Icon && <Icon className="h-4 w-4" style={{ color: accent }} />}</div>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>{children}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/45">{label}</span>{children}</label>;
}
function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-white/40">{text}</p>; }
