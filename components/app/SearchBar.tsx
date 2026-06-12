"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Search, X } from "lucide-react";
import { ProductArt } from "@/components/landing/ProductArt";
import { useLiveProducts } from "@/hooks/useLiveProducts";
import { useT } from "@/hooks/useT";
import { formatPrice, cn } from "@/lib/utils";

const HISTORY_KEY = "oasis-search-history";

export function SearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const { products } = useLiveProducts();
  const { t } = useT();

  const remember = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setHistory((h) => {
      const next = [t, ...h.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearHistory = () => { setHistory([]); try { localStorage.removeItem(HISTORY_KEY); } catch {} };

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.brand.toLowerCase().includes(term) ||
        p.tags?.some((t) => t.toLowerCase().includes(term)),
    ).slice(0, 6);
  }, [q, products]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (id: string) => {
    remember(q);
    setOpen(false);
    setQ("");
    router.push(`/product/${id}`);
  };
  const goAll = () => {
    remember(q);
    setOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(q.trim())}`);
  };
  const runTerm = (term: string) => {
    remember(term);
    setQ("");
    setOpen(false);
    router.push(`/catalog?q=${encodeURIComponent(term)}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active].id);
      else if (q.trim()) goAll();
    } else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="field flex items-center gap-2 rounded-full px-4 py-2">
        <Search className="h-4 w-4 shrink-0 text-fg-muted" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t("topbar.search")}
          className="w-full bg-transparent text-sm outline-none placeholder:text-fg-muted/70"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); setOpen(false); }} aria-label="Clear" className="text-fg-muted transition hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (q.trim() || history.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="popover absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl"
          >
            {!q.trim() ? (
              /* search history — "Вы искали:" */
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">Вы искали</span>
                  <button type="button" onClick={clearHistory} className="font-mono text-[10px] uppercase tracking-wider text-fg-muted transition hover:text-danger">Очистить</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((h) => (
                    <button key={h} type="button" onClick={() => runTerm(h)} className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-fg-muted transition hover:text-accent hover:neon-border">
                      <Clock className="h-3 w-3" /> {h}
                    </button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-fg-muted">No products match “{q.trim()}”.</p>
            ) : (
              <>
                <div className="max-h-[60vh] overflow-y-auto p-1.5">
                  {results.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(p.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl p-2 text-left transition",
                        i === active ? "bg-[var(--panel)]" : "hover:bg-[var(--panel)]",
                      )}
                    >
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-bg-elev">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt={p.title} className="h-full w-full object-cover" />
                        ) : (
                          <ProductArt type={p.type} uid={`search-${p.id}`} hue={p.hue} className="h-full w-full" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        <span className="block truncate font-mono text-[11px] uppercase tracking-wider text-fg-muted">
                          {p.brand}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold">{formatPrice(p.price)}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={goAll}
                  className="flex w-full items-center justify-center gap-2 border-t border-[var(--panel-border)] px-4 py-3 text-xs font-mono uppercase tracking-wider text-accent transition hover:bg-accent/10"
                >
                  <Search className="h-3.5 w-3.5" /> See all results for “{q.trim()}”
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
