"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";
import { Check, FolderPlus, Layers, Palette, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { CountUp, GREEN, LiveStatus } from "./charts";
import { hexToRgb } from "@/lib/sell-data";
import type { AdminTaxonomy } from "@/lib/data/admin-taxonomy";
import {
  createBrand, createCategory, createColor, createTag,
  deleteBrand, deleteCategory, deleteColor, deleteTag,
  renameCategory, updateColor, type ActionResult,
} from "@/app/(admin)/admin/catalog/actions";

const TABS = [
  { id: "categories", label: "Categories", Icon: Layers },
  { id: "brands", label: "Brands", Icon: Tag },
  { id: "colors", label: "Colors", Icon: Palette },
  { id: "tags", label: "Tags", Icon: Tag },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function TaxonomyClient({ data }: { data: AdminTaxonomy }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("categories");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<ActionResult>, okMsg = "Saved") => {
    setBusy(true);
    startTransition(async () => {
      const r = await fn();
      setBusy(false);
      if (!r.ok) toast.error(r.error);
      else { toast.success(okMsg); router.refresh(); }
    });
  };

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: GREEN }}>Taxonomy</p>
        <LiveStatus />
      </div>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-white">Catalog control</h1>
      <p className="mt-1.5 text-sm text-white/55">Full power over the catalog vocabulary — sections, subcategories, brands, colors and tags. Create, rename and delete; everything is live.</p>

      {/* summary */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Sections" value={data.counts.sections} accent="#22ff88" />
        <Tile label="Subcategories" value={data.counts.subsections} accent="#38bdf8" />
        <Tile label="Brands" value={data.counts.brands} accent="#fb7185" />
        <Tile label="Colors" value={data.counts.colors} accent="#a78bfa" />
        <Tile label="Tags" value={data.counts.tags} accent="#fbbf24" />
      </div>

      {/* tabs */}
      <div className="mt-6 inline-flex gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} className="relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold">
              {on && <motion.span layoutId="tax-tab" className="absolute inset-0 rounded-xl" style={{ background: `${GREEN}1f`, boxShadow: `inset 0 0 0 1px ${GREEN}55` }} transition={{ type: "spring", stiffness: 350, damping: 30 }} />}
              <Icon className="relative z-10 h-4 w-4" style={{ color: on ? GREEN : "rgba(255,255,255,0.55)" }} />
              <span className="relative z-10" style={{ color: on ? GREEN : "rgba(255,255,255,0.65)" }}>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "categories" && <Categories data={data} run={run} busy={busy} />}
        {tab === "brands" && <Vocab title="Brands" items={data.brands} onAdd={(n) => run(() => createBrand(n), "Brand added")} onDelete={(id) => run(() => deleteBrand(id), "Brand removed")} busy={busy} placeholder="e.g. Dior" />}
        {tab === "tags" && <Vocab title="Tags" items={data.tags} onAdd={(n) => run(() => createTag(n), "Tag added")} onDelete={(id) => run(() => deleteTag(id), "Tag removed")} busy={busy} placeholder="e.g. electronics" />}
        {tab === "colors" && <Colors data={data} run={run} busy={busy} />}
      </div>
    </div>
  );
}

/* ---------------- categories ---------------- */
function Categories({ data, run, busy }: { data: AdminTaxonomy; run: (fn: () => Promise<ActionResult>, m?: string) => void; busy: boolean }) {
  const [section, setSection] = useState("");
  const [sub, setSub] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input value={section} onChange={(e) => setSection(e.target.value)} placeholder="New top-level section (e.g. Electronics)…"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25" />
        <button disabled={busy || !section.trim()} onClick={() => { run(() => createCategory(section, null), "Section created"); setSection(""); }}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-40" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
          <FolderPlus className="h-4 w-4" /> Add section
        </button>
      </div>

      <div className="grid gap-3">
        {data.categories.length === 0 && <p className="py-8 text-center text-sm text-white/40">No categories yet.</p>}
        {data.categories.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <Layers className="h-4 w-4 shrink-0" style={{ color: GREEN }} />
              {editing === c.id ? (
                <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)} className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white outline-none" />
              ) : (
                <p className="flex-1 font-bold text-white">{c.name}</p>
              )}
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/55">{c.count} products · {c.children.length} sub</span>
              {editing === c.id ? (
                <>
                  <IconBtn onClick={() => { run(() => renameCategory(c.id, editVal), "Renamed"); setEditing(null); }} Icon={Check} tone="green" />
                  <IconBtn onClick={() => setEditing(null)} Icon={X} />
                </>
              ) : (
                <>
                  <IconBtn onClick={() => { setEditing(c.id); setEditVal(c.name); }} Icon={Pencil} />
                  <IconBtn onClick={() => run(() => deleteCategory(c.id), "Section deleted")} Icon={Trash2} tone="red" />
                </>
              )}
            </div>

            {/* children */}
            <div className="mt-3 flex flex-wrap gap-2 pl-7">
              {c.children.map((ch) => (
                <span key={ch.id} className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-1 pl-2.5 pr-1.5 text-xs text-white/80">
                  {ch.name}
                  <span className="font-mono text-[9px] text-white/35">{ch.count}</span>
                  <button onClick={() => run(() => deleteCategory(ch.id), "Removed")} className="rounded p-0.5 text-white/30 transition hover:bg-red-500/20 hover:text-red-400"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <input value={sub[c.id] ?? ""} onChange={(e) => setSub((m) => ({ ...m, [c.id]: e.target.value }))} placeholder="+ subcategory"
                  className="w-32 rounded-lg border border-dashed border-white/15 bg-transparent px-2 py-1 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/30"
                  onKeyDown={(e) => { if (e.key === "Enter" && sub[c.id]?.trim()) { run(() => createCategory(sub[c.id], c.id), "Subcategory added"); setSub((m) => ({ ...m, [c.id]: "" })); } }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- brands / tags ---------------- */
function Vocab({ title, items, onAdd, onDelete, busy, placeholder }: { title: string; items: { id: string; name: string; count: number }[]; onAdd: (n: string) => void; onDelete: (id: string) => void; busy: boolean; placeholder: string }) {
  const [val, setVal] = useState("");
  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val); setVal(""); } }} placeholder={`Add ${title.toLowerCase()} · ${placeholder}`}
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25" />
        <button disabled={busy || !val.trim()} onClick={() => { onAdd(val); setVal(""); }} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-40" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 && <p className="py-8 text-center text-sm text-white/40">No {title.toLowerCase()} yet.</p>}
        <AnimatePresence>
          {items.map((it) => (
            <motion.span key={it.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-3 pr-2 text-sm text-white">
              {it.name}
              <span className="font-mono text-[10px] text-white/35">{it.count}</span>
              <button onClick={() => onDelete(it.id)} className="rounded p-0.5 text-white/30 transition hover:bg-red-500/20 hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------------- colors ---------------- */
function Colors({ data, run, busy }: { data: AdminTaxonomy; run: (fn: () => Promise<ActionResult>, m?: string) => void; busy: boolean }) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#22d3ee");
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5">
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent" />
          <span className="font-mono text-xs text-white/60">{hex}</span>
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { run(() => createColor(name, hex), "Color added"); setName(""); } }} placeholder="Color name (e.g. Midnight)"
          className="min-w-[160px] flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25" />
        <button disabled={busy || !name.trim()} onClick={() => { run(() => createColor(name, hex), "Color added"); setName(""); }} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-40" style={{ background: `${GREEN}1f`, color: GREEN, boxShadow: `inset 0 0 0 1px ${GREEN}55` }}>
          <Plus className="h-4 w-4" /> Add color
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.colors.length === 0 && <p className="py-8 text-center text-sm text-white/40">No colors yet.</p>}
        {data.colors.map((c) => (
          <div key={c.id} className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <label className="relative cursor-pointer">
              <span className="block h-11 w-11 rounded-xl" style={{ background: c.hex, boxShadow: `0 0 14px ${c.hex}66` }} />
              <input type="color" defaultValue={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : "#888888"} onChange={(e) => run(() => updateColor(c.id, e.target.value), "Color updated")} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </label>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{c.name}</p>
              <p className="font-mono text-[10px] text-white/40">{c.hex.toUpperCase()}</p>
              <p className="font-mono text-[9px] text-white/30">{hexToRgb(c.hex)} · {c.count} used</p>
            </div>
            <button onClick={() => run(() => deleteColor(c.id), "Color removed")} className="rounded-lg p-1 text-white/30 transition hover:bg-red-500/20 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] text-white/35">Tip: click any swatch to recolor it live.</p>
    </div>
  );
}

/* ---------------- shared ---------------- */
function Tile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white"><CountUp value={value} /></p>
      <span className="absolute bottom-0 left-0 h-0.5 w-full" style={{ background: `linear-gradient(90deg,${accent},transparent)` }} />
    </div>
  );
}
function IconBtn({ Icon, onClick, tone }: { Icon: typeof Pencil; onClick: () => void; tone?: "green" | "red" }) {
  const color = tone === "green" ? GREEN : tone === "red" ? "#ef4444" : "rgba(255,255,255,0.55)";
  return (
    <button onClick={onClick} className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 transition hover:bg-white/10" style={{ color }}>
      <Icon className="h-4 w-4" />
    </button>
  );
}
