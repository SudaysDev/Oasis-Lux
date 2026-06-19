"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown, ChevronLeft, ChevronRight, Clock, Flame, Glasses, LayoutGrid, Palette, Radio,
  Ruler, Search, Shapes, SlidersHorizontal, SprayCan, Star, Tag, Wallet, Watch, X,
} from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchCategories, groupCategories, type Category } from "@/lib/data/categories";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { ProductCard, ProductCardSkeleton } from "@/components/shop/ProductCard";
import { PriceRange } from "@/components/shop/PriceRange";
import { SELL_COLORS } from "@/lib/sell-data";
import { useMoney } from "@/hooks/useMoney";
import { cn } from "@/lib/utils";
import type { DemoProduct } from "@/lib/landing-data";
import type { ProductType } from "@/types";

type Sort = "newest" | "oldest" | "price_asc" | "price_desc" | "popular" | "rating";
const SORTS: { key: Sort; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "popular", label: "Most popular" },
  { key: "rating", label: "Top rated" },
  { key: "price_asc", label: "Price: low → high" },
  { key: "price_desc", label: "Price: high → low" },
];
const CONDITIONS = [
  { key: "new", label: "New" },
  { key: "like_new", label: "Like new" },
  { key: "used", label: "Used" },
] as const;
// Product types with a hinting icon (perfume / watch / eyewear).
const TYPE_META: { key: ProductType; label: string; Icon: typeof Watch }[] = [
  { key: "perfume", label: "Perfume", Icon: SprayCan },
  { key: "watch", label: "Watches", Icon: Watch },
  { key: "glasses", label: "Eyewear", Icon: Glasses },
];
const PRICE_MAX = 5000;
const PAGE_SIZE = 12;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const isRecent = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < WEEK_MS;

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Section({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--panel-border)] pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          {icon && <span className="text-accent">{icon}</span>}
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Chip({ on, onClick, icon, children }: { on: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition", on ? "neon-border text-accent" : "border-[var(--panel-border)] text-fg-muted hover:text-fg")}
    >
      {icon}
      {children}
    </button>
  );
}

export function CatalogView({ initialQ = "", initialCat = null }: { initialQ?: string; initialCat?: string | null }) {
  const { products, loading } = useLiveProducts();
  const { money } = useMoney();
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState(initialQ);
  const [brandQ, setBrandQ] = useState("");
  const [selCats, setSelCats] = useState<string[]>(initialCat ? [initialCat] : []);
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [selBrands, setSelBrands] = useState<string[]>([]);
  const [selColors, setSelColors] = useState<string[]>([]);
  const [selSizes, setSelSizes] = useState<string[]>([]);
  const [selConditions, setSelConditions] = useState<string[]>([]);
  const [price, setPrice] = useState<[number, number]>([0, PRICE_MAX]);
  const [inStock, setInStock] = useState(false);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [topRated, setTopRated] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [liveOnly, setLiveOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { void fetchCategories(getBrowserClient()).then(setCats); }, []);

  const groups = useMemo(() => groupCategories(cats), [cats]);
  const brands = useMemo(() => Array.from(new Set(products.map((p) => p.brand).filter((b) => b && b !== "—"))).sort(), [products]);
  const sizes = useMemo(() => Array.from(new Set(products.map((p) => p.size).filter(Boolean) as string[])).sort(), [products]);
  // Trending tags: most-used listing tags surfaced as quick chips above the grid.
  const popularTags = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of products) for (const t of p.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }, [products]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = products.filter((p) => {
      if (term && !(p.title.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term) || p.tags?.some((t) => t.toLowerCase().includes(term)))) return false;
      if (selCats.length && !p.tags?.some((t) => selCats.some((c) => c.toLowerCase() === t.toLowerCase()))) return false;
      if (selTypes.length && !selTypes.includes(p.type)) return false;
      if (selBrands.length && !selBrands.includes(p.brand)) return false;
      if (selColors.length && !p.colors?.some((c) => selColors.some((s) => s.toLowerCase() === c.toLowerCase()))) return false;
      if (selSizes.length && !(p.size && selSizes.includes(p.size))) return false;
      if (selConditions.length && !selConditions.includes(p.condition ?? "new")) return false;
      if (p.price < price[0] || p.price > price[1]) return false;
      if (inStock && p.stock <= 0) return false;
      if (dealsOnly && !p.discount) return false;
      if (topRated && p.rating < 4.5) return false;
      if (newOnly && !isRecent(p.createdAt)) return false;
      if (liveOnly && !p.isLive) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "price_asc": return a.price - b.price;
        case "price_desc": return b.price - a.price;
        case "popular": return b.rating - a.rating || (b.discount ?? 0) - (a.discount ?? 0);
        case "rating": return b.rating - a.rating;
        case "oldest": return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
        default: return (b.isLive ? 1 : 0) - (a.isLive ? 1 : 0) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      }
    });
  }, [products, q, selCats, selTypes, selBrands, selColors, selSizes, selConditions, price, inStock, dealsOnly, topRated, newOnly, liveOnly, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeFilters =
    selCats.length + selTypes.length + selBrands.length + selColors.length + selSizes.length + selConditions.length +
    (inStock ? 1 : 0) + (dealsOnly ? 1 : 0) + (topRated ? 1 : 0) + (newOnly ? 1 : 0) + (liveOnly ? 1 : 0) +
    (price[0] > 0 || price[1] < PRICE_MAX ? 1 : 0);
  const resetAll = () => {
    setSelCats([]); setSelTypes([]); setSelBrands([]); setSelColors([]); setSelSizes([]); setSelConditions([]);
    setPrice([0, PRICE_MAX]); setInStock(false); setDealsOnly(false); setTopRated(false); setNewOnly(false); setLiveOnly(false);
    setQ(""); setPage(1);
  };
  const onFilter = (fn: () => void) => { fn(); setPage(1); };
  const filteredBrands = brands.filter((b) => b.toLowerCase().includes(brandQ.trim().toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent"><SlidersHorizontal className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">Catalog</h1>
          <p className="text-sm text-fg-muted">{filtered.length} items{q && <> · “{q}”</>}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* FILTERS — left column */}
        <aside className="card no-scrollbar h-max space-y-4 rounded-2xl p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">Filters {activeFilters > 0 && <span className="text-accent">· {activeFilters}</span>}</p>
            {activeFilters > 0 && <button onClick={resetAll} className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition hover:text-danger">Reset all</button>}
          </div>

          <div className="field flex items-center gap-2 rounded-xl px-3 py-2">
            <Search className="h-4 w-4 text-fg-muted" />
            <input value={q} onChange={(e) => onFilter(() => setQ(e.target.value))} placeholder="Search…" className="w-full bg-transparent text-sm outline-none" />
            {q && <button onClick={() => setQ("")} aria-label="Clear"><X className="h-4 w-4 text-fg-muted" /></button>}
          </div>

          {/* PRICE */}
          <Section title={`Price · ${money(price[0])} – ${money(price[1])}`} icon={<Wallet className="h-3.5 w-3.5" />}>
            <PriceRange min={0} max={PRICE_MAX} value={price} onChange={(v) => onFilter(() => setPrice(v))} />
          </Section>

          {/* TYPE — top-level product kind with hinting icons */}
          <Section title="Type" icon={<Shapes className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-3 gap-1.5">
              {TYPE_META.map(({ key, label, Icon }) => {
                const on = selTypes.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => onFilter(() => setSelTypes((a) => toggle(a, key)))}
                    className={cn("flex flex-col items-center gap-1 rounded-xl border py-2 text-[11px] font-medium transition", on ? "neon-border text-accent" : "border-[var(--panel-border)] text-fg-muted hover:text-fg")}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* STATUS toggles */}
          <Section title="Status" icon={<Radio className="h-3.5 w-3.5" />}>
            <div className="flex flex-wrap gap-1.5">
              <Chip on={dealsOnly} onClick={() => onFilter(() => setDealsOnly((v) => !v))} icon={<Flame className="h-3 w-3" />}>Discounts</Chip>
              <Chip on={inStock} onClick={() => onFilter(() => setInStock((v) => !v))}>In stock</Chip>
              <Chip on={topRated} onClick={() => onFilter(() => setTopRated((v) => !v))} icon={<Star className="h-3 w-3" />}>Top rated</Chip>
              <Chip on={newOnly} onClick={() => onFilter(() => setNewOnly((v) => !v))} icon={<Clock className="h-3 w-3" />}>New this week</Chip>
              <Chip on={liveOnly} onClick={() => onFilter(() => setLiveOnly((v) => !v))} icon={<Radio className="h-3 w-3" />}>Live now</Chip>
              {CONDITIONS.map((c) => (
                <Chip key={c.key} on={selConditions.includes(c.key)} onClick={() => onFilter(() => setSelConditions((a) => toggle(a, c.key)))}>{c.label}</Chip>
              ))}
            </div>
          </Section>

          {/* CATEGORIES */}
          <Section title="Categories" icon={<LayoutGrid className="h-3.5 w-3.5" />} action={selCats.length > 0 ? <button onClick={() => onFilter(() => setSelCats([]))} className="font-mono text-[10px] uppercase text-accent">Clear</button> : undefined}>
            <div className="no-scrollbar max-h-64 space-y-2 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.parent.id}>
                  <button onClick={() => onFilter(() => setSelCats((a) => toggle(a, g.parent.name)))} className={cn("flex items-center gap-1.5 text-left text-xs font-semibold transition", selCats.includes(g.parent.name) ? "text-accent" : "text-fg hover:text-accent")}>
                    {g.parent.icon && <span className="text-sm leading-none">{g.parent.icon}</span>}
                    {g.parent.name}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.children.map((c) => (
                      <button key={c.id} onClick={() => onFilter(() => setSelCats((a) => toggle(a, c.name)))} className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition", selCats.includes(c.name) ? "neon-border text-accent" : "border-[var(--panel-border)] text-fg-muted hover:text-fg")}>
                        {c.icon && <span className="leading-none">{c.icon}</span>}
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* BRANDS */}
          <Section title="Brand" icon={<Tag className="h-3.5 w-3.5" />}>
            <div className="field mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-fg-muted" />
              <input value={brandQ} onChange={(e) => setBrandQ(e.target.value)} placeholder="Search brand…" className="w-full bg-transparent text-xs outline-none" />
            </div>
            <div className="no-scrollbar max-h-40 space-y-0.5 overflow-y-auto pr-1">
              {filteredBrands.map((b) => (
                <label key={b} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs transition hover:bg-[var(--panel)]">
                  <input type="checkbox" checked={selBrands.includes(b)} onChange={() => onFilter(() => setSelBrands((a) => toggle(a, b)))} className="accent-[var(--accent)]" />
                  {b}
                </label>
              ))}
              {filteredBrands.length === 0 && <p className="px-2 py-1 text-xs text-fg-muted">No brands</p>}
            </div>
          </Section>

          {/* COLORS */}
          <Section title="Color" icon={<Palette className="h-3.5 w-3.5" />}>
            <div className="flex flex-wrap gap-1.5">
              {SELL_COLORS.map((c) => {
                const on = selColors.includes(c.name);
                return (
                  <button key={c.name} onClick={() => onFilter(() => setSelColors((a) => toggle(a, c.name)))} title={c.name} aria-label={c.name} className={cn("h-6 w-6 rounded-full border-2 transition hover:scale-110", on ? "border-accent" : "border-transparent")} style={{ background: c.hex }} />
                );
              })}
            </div>
          </Section>

          {/* SIZES / VOLUME */}
          {sizes.length > 0 && (
            <Section title="Size / volume" icon={<Ruler className="h-3.5 w-3.5" />}>
              <div className="flex flex-wrap gap-1.5">
                {sizes.map((s) => (
                  <button key={s} onClick={() => onFilter(() => setSelSizes((a) => toggle(a, s)))} className={cn("rounded-lg border px-2.5 py-1 text-xs transition", selSizes.includes(s) ? "neon-border text-accent" : "border-[var(--panel-border)] text-fg-muted hover:text-fg")}>{s}</button>
                ))}
              </div>
            </Section>
          )}
        </aside>

        {/* GRID */}
        <div>
          {/* trending tags — quick chips that filter by listing tag */}
          {popularTags.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted"><Flame className="h-3.5 w-3.5 text-accent" /> Trending</span>
              {popularTags.map((tg) => (
                <Chip key={tg} on={selCats.some((c) => c.toLowerCase() === tg.toLowerCase())} onClick={() => onFilter(() => setSelCats((a) => toggle(a, tg)))}>{tg}</Chip>
              ))}
            </div>
          )}

          {/* sort bar — right side, above the grid */}
          <div className="mb-4 flex items-center justify-end gap-2">
            <span className="mr-auto text-xs text-fg-muted">{filtered.length} результатов</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">Сортировка</span>
            <div className="relative">
              <button onClick={() => setSortOpen((o) => !o)} className="field flex items-center gap-2 rounded-full px-3.5 py-2 text-sm">
                {SORTS.find((s) => s.key === sort)?.label}
                <ChevronDown className={cn("h-4 w-4 text-fg-muted transition", sortOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {sortOpen && (
                  <>
                    <button aria-label="Close" onClick={() => setSortOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="popover absolute right-0 top-12 z-50 w-52 rounded-xl p-1.5">
                      {SORTS.map((s) => (
                        <button key={s.key} onClick={() => { setSort(s.key); setSortOpen(false); }} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[var(--panel)]", sort === s.key ? "text-accent" : "text-fg-muted")}>
                          {s.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {loading && filtered.length === 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : filtered.length === 0 ? (
            <p className="py-20 text-center text-sm text-fg-muted">Ничего не найдено — попробуй смягчить фильтры.</p>
          ) : (
            <>
              <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence mode="popLayout">
                  {pageItems.map((p: DemoProduct) => (
                    <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.2 }}>
                      <ProductCard product={p} showVariants={!p.isLive} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>

              {/* PAGINATION */}
              {pageCount > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} className="glass grid h-9 w-9 place-items-center rounded-lg text-fg-muted transition hover:text-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  {Array.from({ length: pageCount }).slice(0, 7).map((_, i) => {
                    const n = i + 1;
                    return (
                      <button key={n} onClick={() => setPage(n)} className={cn("grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm transition", n === safePage ? "neon-border text-accent" : "glass text-fg-muted hover:text-fg")}>{n}</button>
                    );
                  })}
                  {pageCount > 7 && <span className="px-1 text-fg-muted">…</span>}
                  <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={safePage === pageCount} className="glass grid h-9 w-9 place-items-center rounded-lg text-fg-muted transition hover:text-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
