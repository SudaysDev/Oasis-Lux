"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowDownUp, BadgePercent, ChevronLeft, ChevronRight, Coins, Dices, Loader2, Plus, Power, Search, Ticket, Wallet, X,
} from "lucide-react";
import { CountUp, GREEN, group, LiveStatus } from "./charts";
import { Select } from "./Select";
import { createPromo, togglePromo } from "@/app/(admin)/admin/promo/actions";
import type { AdminPromoList, AdminPromoRow, PromoStatus } from "@/lib/data/admin-promo";

const TYPE_COLOR: Record<string, string> = { percent: "#22ff88", fixed: "#38bdf8", cashback: "#a78bfa" };
const STATUS_COLOR: Record<PromoStatus, string> = { active: "#22ff88", scheduled: "#38bdf8", expired: "#fbbf24", maxed: "#fb7185", disabled: "#64748b" };
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const valueLabel = (t: string, v: number) => (t === "percent" ? `${v}%` : t === "cashback" ? `${v}% back` : `${group(v)} смн`);
const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

const SORTS = [
  { id: "new", label: "Newest" }, { id: "used", label: "Most used" }, { id: "discount", label: "Most given" },
  { id: "value", label: "Highest value" }, { id: "az", label: "A–Z" },
] as const;
type SortId = (typeof SORTS)[number]["id"];

function randomCode() {
  const w = ["OASIS", "LUX", "VIP", "DROP", "FLASH", "GIFT", "SCENT", "GLOW", "PRIME", "NOVA"];
  return `${w[Math.floor(Math.random() * w.length)]}${Math.floor(10 + Math.random() * 89)}`;
}

export function PromoClient({ data, brands, categories }: { data: AdminPromoList; brands: string[]; categories: { slug: string; label: string }[] }) {
  const router = useRouter();
  const s = data.summary;
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "percent" | "fixed" | "cashback">("all");
  const [status, setStatus] = useState<"all" | PromoStatus>("all");
  const [sort, setSort] = useState<SortId>("new");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const reset = () => setPage(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.promos.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (status !== "all" && p.status !== status) return false;
      if (needle && !`${p.code} ${p.scopeLabel ?? ""} ${p.scope}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by: Record<SortId, (a: AdminPromoRow, b: AdminPromoRow) => number> = {
      new: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      used: (a, b) => b.usedCount + b.redemptions + b.orders - (a.usedCount + a.redemptions + a.orders),
      discount: (a, b) => b.discountGiven - a.discountGiven,
      value: (a, b) => b.value - a.value,
      az: (a, b) => a.code.localeCompare(b.code),
    };
    return [...list].sort(by[sort]);
  }, [data.promos, q, type, status, sort]);

  const PAGE = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Promo Engine</p>
            <LiveStatus />
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Promo codes</h1>
          <p className="mt-1.5 text-sm text-white/55">Create, scope and track every discount, cashback &amp; flat-off code. Click any code for its full dossier.</p>
        </div>
        <button onClick={() => setCreating((v) => !v)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
          {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {creating ? "Close" : "New promo"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Total codes" value={s.total} accent="#38bdf8" />
        <Tile label="Active" value={s.active} accent="#22ff88" />
        <Tile label="Expired" value={s.expired} accent="#fbbf24" />
        <Tile label="Redemptions" value={s.redemptions + s.orders} accent="#a78bfa" />
        <Tile label="Given away" value={s.discountGiven} accent="#fb7185" unit="смн" />
        <Tile label="Cashback" value={s.cashback} accent="#34d399" />
      </div>

      <AnimatePresence>{creating && <CreateForm brands={brands} categories={categories} onDone={() => { setCreating(false); router.refresh(); }} />}</AnimatePresence>

      {/* controls */}
      <div className="sticky top-[68px] z-20 mt-6 rounded-2xl border border-white/10 bg-[#070a10]/85 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Search className="h-4 w-4 text-white/40" />
            <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search code or scope…" className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
            {q && <button onClick={() => { setQ(""); reset(); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
          <Select value={sort} onChange={(v) => { setSort(v as SortId); reset(); }} options={SORTS.map((o) => ({ value: o.id, label: o.label }))} Icon={ArrowDownUp} className="w-44" />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {(["all", "percent", "fixed", "cashback"] as const).map((t) => (
            <Pill key={t} on={type === t} color={t === "all" ? GREEN : TYPE_COLOR[t]} onClick={() => { setType(t); reset(); }}>{t}</Pill>
          ))}
          <span className="mx-1 h-5 w-px bg-white/10" />
          {(["all", "active", "expired", "maxed", "disabled"] as const).map((st) => (
            <Pill key={st} on={status === st} color={st === "all" ? GREEN : STATUS_COLOR[st as PromoStatus]} onClick={() => { setStatus(st); reset(); }}>{st}</Pill>
          ))}
          <span className="ml-auto font-mono text-[11px] text-white/45">{filtered.length} shown</span>
        </div>
      </div>

      {/* list */}
      <div className="mt-4 grid gap-2.5">
        {filtered.length === 0 && <p className="py-16 text-center text-sm text-white/40">No codes match.</p>}
        {pageItems.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.015, 0.4) }}>
            <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/25 hover:bg-white/[0.05]">
              <Link href={`/admin/promo/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: `${TYPE_COLOR[p.type]}1f`, color: TYPE_COLOR[p.type] }}>
                  {p.type === "cashback" ? <Coins className="h-5 w-5" /> : p.type === "fixed" ? <Wallet className="h-5 w-5" /> : <BadgePercent className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-mono font-bold tracking-wide text-white">
                    {p.code}
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${TYPE_COLOR[p.type]}22`, color: TYPE_COLOR[p.type] }}>{valueLabel(p.type, p.value)}</span>
                  </p>
                  <p className="truncate font-mono text-[11px] text-white/45">{p.scopeLabel || p.scope}{p.expiresAt ? ` · ends ${fmtDate(p.expiresAt)}` : ""}</p>
                </div>
              </Link>
              <div className="hidden items-center gap-5 md:flex">
                <Metric label="Used" value={`${p.usedCount + p.redemptions + p.orders}${p.usageLimit ? `/${p.usageLimit}` : ""}`} />
                <Metric label="Given" value={`${group(p.discountGiven)}`} unit="смн" />
                <span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${STATUS_COLOR[p.status]}1f`, color: STATUS_COLOR[p.status] }}>{p.status}</span>
              </div>
              <button onClick={() => togglePromo(p.id, !p.isActive).then(() => router.refresh())} title={p.isActive ? "Disable" : "Enable"} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/60 transition hover:bg-white/10 hover:text-white">
                <Power className="h-4 w-4" style={{ color: p.isActive ? GREEN : undefined }} />
              </button>
            </div>
          </motion.div>
        ))}
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

function CreateForm({ brands, categories, onDone }: { brands: string[]; categories: { slug: string; label: string }[]; onDone: () => void }) {
  const [code, setCode] = useState(randomCode());
  const [type, setType] = useState("percent");
  const [value, setValue] = useState("10");
  const [scope, setScope] = useState("all");
  const [scopeRef, setScopeRef] = useState("");
  const [scopeLabel, setScopeLabel] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const submit = () => {
    setBusy(true);
    startTransition(async () => {
      const r = await createPromo({
        code, type, value: Number(value) || 0, scope,
        scopeRef: scope === "brand" ? scopeRef : scope === "category" ? scopeRef : scope === "product" ? scopeRef : null,
        scopeLabel: scopeLabel.trim() || null,
        minOrder: minOrder ? Number(minOrder) : null, maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null, expiresAt: expiresAt || null, isActive: true,
      });
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(`Promo ${code.toUpperCase()} created`); onDone(); }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
      <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl" style={{ background: "rgba(34,255,136,0.12)" }} />
        <div className="relative">
          <h2 className="mb-4 text-lg font-bold text-white">New promo code</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Code">
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} />
                <button onClick={() => setCode(randomCode())} className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border border-white/10 text-white/60 transition hover:text-white"><Dices className="h-4 w-4" /></button>
              </div>
            </Field>
            <Field label="Type"><Select value={type} onChange={setType} options={[{ value: "percent", label: "Percent off" }, { value: "fixed", label: "Fixed сомонӣ off" }, { value: "cashback", label: "Cashback %" }]} className="w-full" align="left" /></Field>
            <Field label={type === "fixed" ? "Amount · смн" : "Percent · %"}><input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls} /></Field>
            <Field label="Scope"><Select value={scope} onChange={(v) => { setScope(v); setScopeRef(""); }} options={[{ value: "all", label: "Everything" }, { value: "brand", label: "A brand" }, { value: "category", label: "A category" }, { value: "product", label: "A product (id)" }]} className="w-full" align="left" /></Field>
            {scope === "brand" && <Field label="Brand"><Select value={scopeRef || "—"} onChange={(v) => setScopeRef(v === "—" ? "" : v)} options={[{ value: "—", label: "Pick a brand" }, ...brands.map((b) => ({ value: b, label: b }))]} className="w-full" align="left" /></Field>}
            {scope === "category" && <Field label="Category"><Select value={scopeRef || "—"} onChange={(v) => setScopeRef(v === "—" ? "" : v)} options={[{ value: "—", label: "Pick a category" }, ...categories.map((c) => ({ value: c.slug, label: c.label }))]} className="w-full" align="left" /></Field>}
            {scope === "product" && <Field label="Product ID"><input value={scopeRef} onChange={(e) => setScopeRef(e.target.value)} placeholder="product uuid" className={`${inputCls} font-mono`} /></Field>}
            <Field label="Scope label (shown on card)"><input value={scopeLabel} onChange={(e) => setScopeLabel(e.target.value)} placeholder="e.g. Tom Ford only" className={inputCls} /></Field>
            <Field label="Min order · смн (optional)"><input value={minOrder} onChange={(e) => setMinOrder(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} /></Field>
            <Field label="Max discount · смн (optional)"><input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} /></Field>
            <Field label="Usage limit (optional)"><input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="unlimited" className={inputCls} /></Field>
            <Field label="Expires (optional)"><input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} /></Field>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button onClick={onDone} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5">Cancel</button>
            <button onClick={submit} disabled={busy} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Create promo
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/45">{label}</span>{children}</label>;
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
function Pill({ on, color, onClick, children }: { on: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition" style={on ? { background: `${color}1f`, color, boxShadow: `inset 0 0 0 1px ${color}55` } : { color: "rgba(255,255,255,0.55)" }}>{children}</button>
  );
}
function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">{children}</button>;
}
