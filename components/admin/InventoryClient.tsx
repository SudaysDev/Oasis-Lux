"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowDownUp,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Copy,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { CountUp, GREEN, group, LiveStatus } from "./charts";
import { Select } from "./Select";
import type { AdminInventory, ProductRow } from "@/lib/data/admin-inventory";

const TYPE_COLOR: Record<string, string> = { perfume: "#22ff88", watch: "#38bdf8", glasses: "#a78bfa" };
const pretty = (s: string) => s.replace(/^[a-z]+-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const stockColor = (s: number) => (s === 0 ? "#ef4444" : s <= 3 ? "#fbbf24" : "#22ff88");

const SORTS = [
  { value: "new", label: "Newest" },
  { value: "old", label: "Oldest" },
  { value: "price_hi", label: "Price ↓" },
  { value: "price_lo", label: "Price ↑" },
  { value: "stock_hi", label: "Stock ↓" },
  { value: "stock_lo", label: "Stock ↑" },
  { value: "rating", label: "Top rated" },
  { value: "az", label: "A–Z" },
];

export function InventoryClient({ data }: { data: AdminInventory }) {
  const s = data.summary;
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [cat, setCat] = useState("all");
  const [brand, setBrand] = useState("all");
  const [cond, setCond] = useState("all");
  const [stockF, setStockF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<ProductRow | null>(null);
  const reset = () => setPage(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.products.filter((p) => {
      if (type !== "all" && p.type !== type) return false;
      if (cat !== "all" && p.category !== cat) return false;
      if (brand !== "all" && p.brand !== brand) return false;
      if (cond !== "all" && p.condition !== cond) return false;
      if (stockF === "in" && p.stock <= 0) return false;
      if (stockF === "low" && !(p.stock > 0 && p.stock <= 3)) return false;
      if (stockF === "out" && p.stock !== 0) return false;
      if (statusF === "active" && !p.isActive) return false;
      if (statusF === "inactive" && p.isActive) return false;
      if (needle) {
        const hay = `${p.title} ${p.brand} ${p.seller} ${p.id} ${p.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const by: Record<string, (a: ProductRow, b: ProductRow) => number> = {
      new: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      old: (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
      price_hi: (a, b) => b.price - a.price,
      price_lo: (a, b) => a.price - b.price,
      stock_hi: (a, b) => b.stock - a.stock,
      stock_lo: (a, b) => a.stock - b.stock,
      rating: (a, b) => b.rating - a.rating,
      az: (a, b) => a.title.localeCompare(b.title),
    };
    return [...list].sort(by[sort]);
  }, [data.products, q, type, cat, brand, cond, stockF, statusF, sort]);

  const PAGE = 14;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  const opt = (arr: string[], allLabel: string, prettify = false) => [{ value: "all", label: allLabel }, ...arr.map((v) => ({ value: v, label: prettify ? pretty(v) : v.charAt(0).toUpperCase() + v.slice(1) }))];

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Inventory</p>
            <LiveStatus />
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Product control</h1>
          <p className="mt-1.5 text-sm text-white/55">Every product ever listed — search, filter, inspect and manage the whole catalog.</p>
        </div>
        <button onClick={() => toast("Add-product drawer arrives with the Inventory module.", { icon: "➕" })} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wider transition" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {/* summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Products" value={s.total} accent="#38bdf8" Icon={Package} />
        <Tile label="Active" value={s.active} accent="#22ff88" />
        <Tile label="Units stock" value={s.totalStock} accent="#a78bfa" Icon={Boxes} />
        <Tile label="Low stock" value={s.lowStock} accent="#fbbf24" />
        <Tile label="Out of stock" value={s.outOfStock} accent="#ef4444" />
        <Tile label="Stock value" value={s.totalValue} unit="смн" accent="#34d399" Icon={Wallet} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Brands" value={s.brands} accent="#fb7185" Icon={Tag} />
        <Tile label="Categories" value={s.categories} accent="#60a5fa" Icon={Layers} />
        <Tile label="Avg price" value={s.avgPrice} unit="смн" accent="#22ff88" />
        <Tile label="Avg rating" value={s.avgRating} unit="★" accent="#fbbf24" Icon={Star} />
        <Tile label="Inactive" value={s.inactive} accent="#ef4444" />
        {data.byType[0] && <Tile label={`Top · ${data.byType.sort((a, b) => b.value - a.value)[0].label}`} value={data.byType[0].value} accent="#a78bfa" />}
      </div>

      {/* controls */}
      <div className="sticky top-[68px] z-20 mt-6 rounded-2xl border border-white/10 bg-[#070a10]/90 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Search className="h-4 w-4 text-white/40" />
            <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Search title, brand, seller, tag, id…" className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/35" />
            {q && <button onClick={() => { setQ(""); reset(); }} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>}
          </div>
          <Select value={sort} onChange={(v) => { setSort(v); reset(); }} options={SORTS} Icon={ArrowDownUp} className="w-40" />
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Select value={type} onChange={(v) => { setType(v); reset(); }} options={opt(data.facets.types, "All types")} className="w-36" align="left" />
          <Select value={cat} onChange={(v) => { setCat(v); reset(); }} options={opt(data.facets.categories, "All categories", true)} className="w-44" align="left" />
          <Select value={brand} onChange={(v) => { setBrand(v); reset(); }} options={opt(data.facets.brands, "All brands")} className="w-40" align="left" />
          <Select value={cond} onChange={(v) => { setCond(v); reset(); }} options={opt(data.facets.conditions, "Any condition")} className="w-40" align="left" />
          <Select value={stockF} onChange={(v) => { setStockF(v); reset(); }} options={[{ value: "all", label: "Any stock" }, { value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} className="w-36" align="left" />
          <Select value={statusF} onChange={(v) => { setStatusF(v); reset(); }} options={[{ value: "all", label: "Any status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} className="w-32" align="left" />
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-white/45"><Package className="h-3.5 w-3.5" /> {filtered.length} shown</span>
        </div>
      </div>

      {/* table */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <div className="hidden grid-cols-[1fr_90px_90px_90px_80px_110px_44px] gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-white/40 lg:grid">
          <span>Product</span><span className="text-right">Price</span><span className="text-right">Stock</span><span className="text-right">Rating</span><span>Status</span><span>Seller</span><span />
        </div>
        {pageItems.length === 0 && <p className="py-16 text-center text-sm text-white/40">No products match your filters.</p>}
        {pageItems.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/5 px-4 py-3 transition hover:bg-white/[0.03] lg:grid-cols-[1fr_90px_90px_90px_80px_110px_44px]">
            <Link href={`/admin/products/${p.id}`} className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/5" style={{ boxShadow: `inset 0 0 0 1px ${TYPE_COLOR[p.type] ?? GREEN}33` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-white/30" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white transition hover:text-[#22ff88]">{p.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase" style={{ background: `${TYPE_COLOR[p.type] ?? GREEN}1f`, color: TYPE_COLOR[p.type] ?? GREEN }}>{p.category ? pretty(p.category) : p.type}</span>
                  <span className="font-mono text-[10px] text-white/45">{p.brand}</span>
                  <span className="font-mono text-[9px] text-white/25">{p.type}</span>
                </div>
              </div>
            </Link>
            <span className="hidden text-right font-mono text-sm font-bold text-white lg:block">{group(p.price)}<span className="text-[10px] text-white/40"> смн</span></span>
            <span className="hidden text-right font-mono text-sm font-bold lg:block" style={{ color: stockColor(p.stock) }}>{p.stock}</span>
            <span className="hidden text-right font-mono text-sm lg:block" style={{ color: "#fbbf24" }}>{p.rating ? `${p.rating}★` : "—"}</span>
            <span className="hidden lg:block"><span className="rounded-full px-2 py-0.5 font-mono text-[9px] uppercase" style={p.isActive ? { background: "rgba(34,255,136,0.15)", color: GREEN } : { background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{p.isActive ? "active" : "off"}</span></span>
            <Link href={`/admin/users/${p.sellerId}`} className="hidden truncate font-mono text-xs text-white/55 transition hover:text-white lg:block">@{p.seller}</Link>
            <div className="flex items-center justify-end gap-2 lg:block">
              <span className="font-mono text-sm font-bold text-white lg:hidden">{group(p.price)} смн · <span style={{ color: stockColor(p.stock) }}>{p.stock}</span></span>
              <button onClick={() => setTarget(p)} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* pagination */}
      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-1.5">
          <PageBtn disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft className="h-4 w-4" /></PageBtn>
          {Array.from({ length: pageCount }).map((_, i) => {
            if (pageCount > 7 && Math.abs(i - safePage) > 2 && i !== 0 && i !== pageCount - 1) {
              if (i === safePage - 3 || i === safePage + 3) return <span key={i} className="px-1 text-white/30">…</span>;
              return null;
            }
            return (
              <button key={i} onClick={() => setPage(i)} className="grid h-9 min-w-9 place-items-center rounded-lg border px-2 font-mono text-sm transition"
                style={i === safePage ? { borderColor: `${GREEN}66`, background: `${GREEN}1f`, color: GREEN } : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>{i + 1}</button>
            );
          })}
          <PageBtn disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight className="h-4 w-4" /></PageBtn>
          <span className="ml-3 font-mono text-[11px] text-white/40">Page {safePage + 1} / {pageCount} · {filtered.length} items</span>
        </div>
      )}

      {/* action modal */}
      <AnimatePresence>
        {target && (
          <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTarget(null)}>
            <motion.div onClick={(e) => e.stopPropagation()} initial={{ scale: 0.92, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 12, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }} className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#0a0e16] p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {target.image ? <img src={target.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-white/30" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{target.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-white/45">{target.brand} · {target.type}</p>
                  </div>
                </div>
                <button onClick={() => setTarget(null)} className="text-white/40 transition hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini label="Price" value={`${group(target.price)}`} />
                <Mini label="Stock" value={String(target.stock)} color={stockColor(target.stock)} />
                <Mini label="Rating" value={target.rating ? `${target.rating}★` : "—"} />
              </div>
              <div className="mt-4 grid gap-2">
                <Link href={`/admin/users/${target.sellerId}`} className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-white/5"><Package className="h-4 w-4 text-white/70" /> View seller @{target.seller}</Link>
                <Link href={`/admin/products/${target.id}`} className="flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition hover:bg-white/5" style={{ borderColor: `${GREEN}44`, color: GREEN }}><Pencil className="h-4 w-4" /> Open product editor</Link>
                <Act Icon={Copy} label="Duplicate" onClick={() => { setTarget(null); toast("Duplicate wires up with Full Control.", { icon: "📑" }); }} />
                <Act Icon={Trash2} label="Delete product" danger onClick={() => { setTarget(null); toast("Deletion goes live with Full Control.", { icon: "🗑️" }); }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tile({ label, value, accent, unit, Icon }: { label: string; value: number; accent: string; unit?: string; Icon?: typeof Package }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
        {Icon && <Icon className="h-4 w-4" style={{ color: accent }} />}
      </div>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} />{unit && <span className="ml-1 text-sm font-bold" style={{ color: accent }}>{unit}</span>}</p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </motion.div>
  );
}
function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] py-2">
      <p className="font-mono text-[8px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="font-mono text-sm font-bold" style={{ color: color ?? "#fff" }}>{value}</p>
    </div>
  );
}
function PageBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">{children}</button>;
}
function Act({ Icon, label, onClick, danger }: { Icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${danger ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-white/10 text-white hover:bg-white/5"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
