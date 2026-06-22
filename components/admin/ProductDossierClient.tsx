"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft, Ban, Boxes, Eye, EyeOff, Heart, ImagePlus, Loader2, Lock, Package, Repeat, Save, ShoppingBag, ShoppingCart, Slash, Sparkles, Star, Timer, Trash2, Wallet, X,
} from "lucide-react";
import { AreaChart, CountUp, Funnel, GREEN, group, HBars, LiveStatus, StatusBars } from "./charts";
import { ModerationPanel } from "./ModerationPanel";
import { Select } from "./Select";
import {
  adminDeleteProduct, adminSetProductFlag, adminSetProductImages, adminToggleProduct, adminUpdateProduct, adminUploadProductImage,
  type ActionResult, type ProductFlag,
} from "@/app/(admin)/admin/products/[id]/actions";
import type { AdminProductDossier } from "@/lib/data/admin-product";

const STATUS_COLOR: Record<string, string> = { placed: "#22ff88", processing: "#38bdf8", out_for_delivery: "#a78bfa", arrived: "#fbbf24", fulfilled: "#22c55e", cancelled: "#ef4444" };
const pretty = (s: string) => s.replace(/^[a-z]+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
/** A sanction value ('perm' | ISO until) is active when permanent or not yet expired. */
const sActive = (v?: string) => !!v && (v === "perm" || new Date(v) > new Date());
const sUntilLabel = (v?: string) => (!sActive(v) ? "" : v === "perm" ? "perm" : `until ${fmtDateTime(v!)}`);
const PRODUCT_FLAGS: { flag: ProductFlag; label: string; desc: string; Icon: typeof Ban; good?: boolean }[] = [
  { flag: "hidden", label: "Shadow-hide", desc: "Vanish from storefront, search & recs", Icon: EyeOff },
  { flag: "frozen", label: "Freeze listing", desc: "Seller can't edit or delete it", Icon: Lock },
  { flag: "no_reviews", label: "Block reviews", desc: "No new reviews accepted", Icon: Star },
  { flag: "no_orders", label: "Block orders", desc: "Can't be purchased", Icon: Ban },
  { flag: "featured", label: "Feature", desc: "Pin & promote across the grid", Icon: Sparkles, good: true },
];
const _DAY = 86_400_000, _HOUR = 3_600_000, _MIN = 60_000;
function _unit(w: string): number | null {
  if (/^(mo|month|мес)/.test(w)) return 30 * _DAY;
  if (/^(w|wk|week|нед)/.test(w)) return 7 * _DAY;
  if (/^(d|day|дн|день|дня|дней|сут)/.test(w)) return _DAY;
  if (/^(h|hr|hour|час|ч)/.test(w)) return _HOUR;
  if (/^(m|min|мин|м)/.test(w)) return _MIN;
  return null;
}
/** `{}` = permanent · `{ms}` = timed · null = unparseable. Durations or an absolute date. */
function parseDur(raw: string): { ms?: number } | null {
  const s = raw.trim();
  if (!s) return {};
  if (/^(perm|permanent|forever|навсегда|перм|нав)/i.test(s)) return {};
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return { ms: parseFloat(s.replace(",", ".")) * _DAY };
  let ms = 0, matched = false;
  const re = /(\d+(?:[.,]\d+)?)\s*([a-zа-яё]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) { const mult = _unit(m[2].toLowerCase()); if (mult) { ms += parseFloat(m[1].replace(",", ".")) * mult; matched = true; } }
  if (matched && ms > 0) return { ms };
  const d = new Date(s);
  if (!isNaN(d.getTime())) { const diff = d.getTime() - Date.now(); if (diff > 0) return { ms: diff }; }
  return null;
}
function flagPreview(term: string): { ok: boolean; text: string } | null {
  if (!term.trim()) return null;
  const pv = parseDur(term);
  if (!pv) return { ok: false, text: "can't read that" };
  if (pv.ms === undefined) return { ok: true, text: "permanent" };
  return { ok: true, text: `lifts ${fmtDateTime(new Date(Date.now() + pv.ms).toISOString())}` };
}

export function ProductDossierClient({ d }: { d: AdminProductDossier }) {
  const router = useRouter();
  const p = d.product;
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [flagTerm, setFlagTerm] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // editable state
  const [title, setTitle] = useState(p.title);
  const [brand, setBrand] = useState(p.brand);
  const [price, setPrice] = useState(String(p.price));
  const [stock, setStock] = useState(String(p.stock));
  const [condition, setCondition] = useState(p.condition);
  const [type, setType] = useState(p.type);
  const [category, setCategory] = useState(p.category ?? "");
  const [color, setColor] = useState(p.color ?? "");
  const [description, setDescription] = useState(p.description);
  const [tags, setTags] = useState<string[]>(p.tags);
  const [tagInput, setTagInput] = useState("");
  const [active, setActive] = useState(p.isActive);

  const run = (fn: () => Promise<ActionResult>, ok = "Saved") => {
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(ok); router.refresh(); }
    });
  };

  const save = () => run(() => adminUpdateProduct(p.id, {
    title: title.trim(), brand: brand.trim(), price: Number(price) || 0, stock: Number(stock) || 0,
    condition, type, category: category || null, color: color || null, description, tags,
  }), "Product updated");

  const toggle = () => { const next = !active; setActive(next); run(() => adminToggleProduct(p.id, next), next ? "Activated" : "Deactivated"); };
  const toggleFlag = (flag: ProductFlag) => {
    if (sActive(p.sanctions[flag])) { run(() => adminSetProductFlag(p.id, flag, false), "Lifted"); return; }
    const pv = parseDur(flagTerm);
    if (!pv) { toast.error("Couldn't read the duration. Try \"2h\", \"7 days\", a date, or leave empty for permanent."); return; }
    run(() => adminSetProductFlag(p.id, flag, true, pv.ms), pv.ms === undefined ? "Applied" : "Applied · timed");
  };
  const removeImage = (url: string) => run(() => adminSetProductImages(p.id, p.images.filter((i) => i !== url)), "Image removed");

  const upload = (file: File) => {
    setUploading(true);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const r = await adminUploadProductImage(p.id, fd);
      setUploading(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success("Image added"); router.refresh(); }
    });
  };

  const colorHex = d.taxonomy.colors.find((c) => c.name === color)?.hex;
  const brandOpts = [...(brand && !d.taxonomy.brands.includes(brand) ? [brand] : []), ...d.taxonomy.brands].map((b) => ({ value: b, label: b }));

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/products" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to inventory</Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block"><LiveStatus /></span>
          <button onClick={toggle} disabled={busy} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition" style={active ? { borderColor: `${GREEN}55`, color: GREEN } : { borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}>
            {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {active ? "Active" : "Inactive"}
          </button>
          <button onClick={() => setConfirm(true)} className="flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 transition hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      </div>

      {/* header */}
      <div className="mt-4 grid gap-5 lg:grid-cols-[260px_1fr]">
        <div>
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Package className="h-10 w-10 text-white/20" /></div>}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.images.map((img) => (
              <div key={img} className="group relative h-14 w-14 overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button onClick={() => removeImage(img)} className="absolute inset-0 grid place-items-center bg-black/60 opacity-0 transition group-hover:opacity-100"><Trash2 className="h-4 w-4 text-red-400" /></button>
              </div>
            ))}
            <button onClick={() => fileRef.current?.click()} disabled={uploading || p.images.length >= 8} className="grid h-14 w-14 place-items-center rounded-lg border border-dashed border-white/20 text-white/40 transition hover:border-white/40 hover:text-white disabled:opacity-40">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">{p.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-white/55">{p.brand || "—"}</span>
            {p.category && <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/70">{pretty(p.category)}</span>}
            <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase text-white/50">{p.type}</span>
            <Link href={`/admin/users/${d.seller.id}`} className="font-mono text-xs text-white/55 transition hover:text-white">· @{d.seller.username}</Link>
            <span className="font-mono text-[11px] text-white/35">· listed {fmtDate(p.createdAt)}</span>
          </div>
          {(!p.isActive || PRODUCT_FLAGS.some((f) => sActive(p.sanctions[f.flag]))) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!p.isActive && <FlagChip color="#ef4444">inactive</FlagChip>}
              {PRODUCT_FLAGS.filter((f) => sActive(p.sanctions[f.flag])).map((f) => (
                <FlagChip key={f.flag} color={f.good ? "#22ff88" : "#fb7185"}>{f.label.toLowerCase()}{p.sanctions[f.flag] !== "perm" ? " ⏱" : ""}</FlagChip>
              ))}
            </div>
          )}
          <p className="mt-3 font-mono text-xs text-white/35">ID {p.id}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Price" value={p.price} unit="смн" />
            <Stat label="Stock" value={p.stock} accent={p.stock === 0 ? "#ef4444" : p.stock <= 3 ? "#fbbf24" : "#22ff88"} />
            <Stat label="Rating" value={d.stats.rating} unit="★" accent="#fbbf24" />
            <Stat label="Reviews" value={d.stats.reviews} accent="#a78bfa" />
          </div>
        </div>
      </div>

      {/* stats */}
      <SectionTitle>Performance</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Times ordered" value={d.stats.timesOrdered} accent="#38bdf8" Icon={ShoppingBag} />
        <Stat label="Units sold" value={d.stats.unitsSold} accent="#22ff88" Icon={Boxes} />
        <Stat label="Revenue" value={d.stats.revenue} unit="смн" Icon={Wallet} />
        <Stat label="Buyers" value={d.stats.buyers} accent="#a78bfa" />
        <Stat label="Favorited" value={d.stats.favorites} accent="#fb7185" Icon={Heart} />
        <Stat label="In carts" value={d.stats.cartUnits} accent="#fbbf24" Icon={ShoppingCart} />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" glow="rgba(34,255,136,0.12)">
          <CardHead kicker="30-day" title="Units sold" />
          <AreaChart data={d.sales30d} />
        </Card>
        <Card glow="rgba(56,189,248,0.12)">
          <CardHead kicker="Pipeline" title="Order status" />
          <StatusBars data={d.byStatus} />
        </Card>
      </div>

      {/* conversion + demand */}
      <SectionTitle>Conversion &amp; demand</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Cancelled" value={d.extra.cancelled} accent="#ef4444" Icon={Slash} />
        <Stat label="Cancel rate" value={d.extra.cancelRate} unit="%" accent={d.extra.cancelRate >= 30 ? "#ef4444" : "#fbbf24"} />
        <Stat label="Repeat buyers" value={d.extra.repeatBuyers} accent="#a78bfa" Icon={Repeat} />
        <Stat label="Avg sale price" value={d.extra.avgSalePrice} unit="смн" Icon={Wallet} />
        <Stat label="Last sale" value={d.extra.daysSinceLastSale ?? 0} unit={d.extra.daysSinceLastSale === null ? "" : "d ago"} accent="#38bdf8" Icon={Timer} />
        <Stat label="Sell-through" value={d.extra.sellThroughDays} unit="d/u" accent="#34d399" />
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,255,136,0.12)">
          <CardHead kicker="Interest → loyalty" title="Conversion funnel" />
          <Funnel data={d.funnel} />
        </Card>
        <Card glow="rgba(56,189,248,0.1)">
          <CardHead kicker="Geography" title="Units sold by region" />
          <HBars data={d.regions} />
        </Card>
      </div>

      {/* audience — who wants it */}
      <SectionTitle>Audience</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(251,113,133,0.12)">
          <CardHead kicker={`${d.favoritedBy.length} people`} title="Favorited by" />
          <div className="no-scrollbar max-h-[320px] space-y-2 overflow-y-auto">
            {d.favoritedBy.length === 0 && <Empty text="Nobody favorited this yet." />}
            {d.favoritedBy.map((u) => (
              <Link key={u.id + u.at} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:border-white/20">
                <span className="flex min-w-0 items-center gap-2"><Heart className="h-3.5 w-3.5 shrink-0 text-[#fb7185]" /><span className="truncate text-sm text-white">@{u.username}</span></span>
                <span className="shrink-0 font-mono text-[10px] text-white/40">{fmtDate(u.at)}</span>
              </Link>
            ))}
          </div>
        </Card>
        <Card glow="rgba(251,191,36,0.12)">
          <CardHead kicker={`${d.inCartBy.length} people`} title="In cart right now" />
          <div className="no-scrollbar max-h-[320px] space-y-2 overflow-y-auto">
            {d.inCartBy.length === 0 && <Empty text="Not in anyone's cart." />}
            {d.inCartBy.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 transition hover:border-white/20">
                <span className="flex min-w-0 items-center gap-2"><ShoppingCart className="h-3.5 w-3.5 shrink-0 text-[#fbbf24]" /><span className="truncate text-sm text-white">@{u.username}</span></span>
                <span className="shrink-0 font-mono text-xs text-white/55">×{u.qty}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* recent orders + reviews */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card glow="rgba(34,197,94,0.1)">
          <CardHead kicker="History" title="Recent orders" />
          <div className="no-scrollbar max-h-[320px] divide-y divide-white/5 overflow-y-auto">
            {d.recentOrders.length === 0 && <Empty text="Never ordered yet." />}
            {d.recentOrders.map((o) => (
              <div key={o.id + o.created_at} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="truncate text-sm text-white">@{o.buyer} · ×{o.qty}</p><p className="font-mono text-[10px] text-white/40">#{o.id.slice(0, 8)} · {fmtDate(o.created_at)}</p></div>
                <div className="flex items-center gap-2"><span className="font-mono text-sm text-white">{group(o.total)} смн</span><span className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase" style={{ background: `${STATUS_COLOR[o.status] ?? "#888"}1f`, color: STATUS_COLOR[o.status] ?? "#888" }}>{o.status.replace(/_/g, " ")}</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card glow="rgba(251,191,36,0.1)">
          <CardHead kicker="Feedback" title={`${d.stats.rating || "—"}★ · ${d.stats.reviews} reviews`} />
          <div className="no-scrollbar max-h-[320px] space-y-2 overflow-y-auto">
            {d.reviewsList.length === 0 && <Empty text="No reviews yet." />}
            {d.reviewsList.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">@{r.author}</span><span className="font-mono text-sm text-[#fbbf24]">{"★".repeat(r.rating)}</span></div>
                {r.body && <p className="mt-1 text-sm text-white/65">{r.body}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SANCTIONS */}
      <SectionTitle>Sanctions &amp; control</SectionTitle>
      <Card glow="rgba(239,68,68,0.12)">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-white/45">New sanction lasts</span>
          <input value={flagTerm} onChange={(e) => setFlagTerm(e.target.value)} placeholder={'empty = permanent · "2h" · "7 days" · "2026-07-01"'} className={`${inputCls} flex-1`} />
          {(() => { const pv = flagPreview(flagTerm); return pv ? <span className={`shrink-0 font-mono text-[11px] ${pv.ok ? "text-amber-300/80" : "text-red-400/80"}`}>{pv.ok && flagTerm.trim() ? `⏱ ${pv.text}` : pv.text}</span> : <span className="shrink-0 font-mono text-[11px] text-white/35">permanent</span>; })()}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_FLAGS.map((f) => {
            const on = sActive(p.sanctions[f.flag]);
            return <PFlag key={f.flag} on={on} label={f.label} desc={on ? sUntilLabel(p.sanctions[f.flag]) : f.desc} onClick={() => toggleFlag(f.flag)} disabled={busy} Icon={f.Icon} good={f.good} />;
          })}
        </div>
      </Card>

      {/* MODERATION */}
      <SectionTitle>Discipline</SectionTitle>
      <ModerationPanel subjectType="product" subjectId={p.id} revalidateId={p.id} violations={d.violations} />

      {/* EDITOR */}
      <SectionTitle>Edit product · full control</SectionTitle>
      <Card glow="rgba(167,139,250,0.12)">
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
          <Field label="Brand"><Select value={brand || "—"} onChange={(v) => setBrand(v === "—" ? "" : v)} options={[{ value: "—", label: "No brand" }, ...brandOpts]} className="w-full" align="left" /></Field>
          <Field label="Price · TJS"><input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls} /></Field>
          <Field label="Stock"><input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={inputCls} /></Field>
          <Field label="Category"><Select value={category || "—"} onChange={(v) => setCategory(v === "—" ? "" : v)} options={[{ value: "—", label: "No category" }, ...d.taxonomy.categories.map((c) => ({ value: c.slug, label: c.label }))]} className="w-full" align="left" /></Field>
          <Field label="Class (legacy type)"><Select value={type} onChange={setType} options={[{ value: "perfume", label: "Perfume" }, { value: "watch", label: "Watch" }, { value: "glasses", label: "Glasses" }]} className="w-full" align="left" /></Field>
          <Field label="Condition"><Select value={condition} onChange={setCondition} options={[{ value: "new", label: "New" }, { value: "like_new", label: "Like new" }, { value: "used", label: "Used" }]} className="w-full" align="left" /></Field>
          <Field label="Color">
            <div className="flex items-center gap-2">
              {colorHex && <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: colorHex, boxShadow: `0 0 10px ${colorHex}66` }} />}
              <Select value={color || "—"} onChange={(v) => setColor(v === "—" ? "" : v)} options={[{ value: "—", label: "No color" }, ...d.taxonomy.colors.map((c) => ({ value: c.name, label: c.name }))]} className="w-full" align="left" />
            </div>
          </Field>
        </div>

        <Field label="Description" className="mt-4">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputCls} resize-y`} />
        </Field>

        <Field label="Tags" className="mt-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white">{t}<button onClick={() => setTags((a) => a.filter((x) => x !== t))} className="text-white/40 hover:text-red-400"><X className="h-3 w-3" /></button></span>
            ))}
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { e.preventDefault(); if (!tags.includes(tagInput.trim().toLowerCase())) setTags((a) => [...a, tagInput.trim().toLowerCase()]); setTagInput(""); } }} placeholder="+ tag" className="min-w-[80px] flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/35" />
          </div>
        </Field>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button onClick={() => router.refresh()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5">Reset</button>
          <button onClick={save} disabled={busy} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wider transition disabled:opacity-50" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </button>
        </div>
      </Card>

      {/* delete confirm */}
      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirm(false)}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[#0a0e16] p-5">
              <p className="flex items-center gap-2 font-bold text-white"><Trash2 className="h-5 w-5 text-red-400" /> Delete this product?</p>
              <p className="mt-2 text-sm text-white/60">“{p.title}” will be permanently removed from the catalog. This can&apos;t be undone.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setConfirm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:bg-white/5">Cancel</button>
                <button onClick={() => startTransition(() => adminDeleteProduct(p.id))} className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/30">Delete forever</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      {children}
    </label>
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
function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-white/40">{text}</p>; }
function FlagChip({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className="rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: `${color}22`, color }}>{children}</span>;
}
function PFlag({ on, label, desc, onClick, disabled, Icon, good = false }: { on: boolean; label: string; desc: string; onClick: () => void; disabled: boolean; Icon: typeof Ban; good?: boolean }) {
  const c = good ? GREEN : "#ef4444";
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-50" style={on ? { borderColor: `${c}55`, background: `${c}14` } : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: on ? c : "rgba(255,255,255,0.5)" }} />
      <div className="min-w-0">
        <p className="text-sm font-bold" style={{ color: on ? (good ? "#86efac" : "#fca5a5") : "#fff" }}>{label}{on && " · ON"}</p>
        <p className="text-[11px] text-white/45">{desc}</p>
      </div>
    </button>
  );
}
