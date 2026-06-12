"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Plus, Search, Tag, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { fetchCategories, groupCategories, type Category } from "@/lib/data/categories";
import { cn } from "@/lib/utils";

/**
 * Multi-select category / tag picker — real GET from the `categories` table.
 * A product can carry several tags (iPhone 16 → "iPhone" + "Phones" + "Electronics").
 * Styled to match BrandSelect.
 */
export function CategorySelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchCategories(getBrowserClient()).then((c) => !cancelled && setCats(c));
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => groupCategories(cats), [cats]);
  const term = q.trim().toLowerCase();
  const filteredGroups = useMemo(
    () =>
      groups
        .map((g) => ({
          parent: g.parent,
          children: g.children.filter((c) => !term || c.name.toLowerCase().includes(term)),
          parentMatches: !term || g.parent.name.toLowerCase().includes(term),
        }))
        .filter((g) => g.parentMatches || g.children.length > 0),
    [groups, term],
  );

  const has = (name: string) => value.includes(name);
  const toggle = (name: string) => onChange(has(name) ? value.filter((v) => v !== name) : [...value, name]);
  const showCustom = term.length > 0 && !cats.some((c) => c.name.toLowerCase() === term);

  return (
    <div>
      {/* selected tags */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs text-accent">
              {t}
              <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`} className="transition hover:text-fg">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} className="field flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-fg-muted">
            <Tag className="h-4 w-4" />
            {value.length ? `${value.length} selected` : "Add categories & tags"}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-fg-muted transition", open && "rotate-180")} />
        </button>

        <AnimatePresence>
          {open && (
            <>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 340, damping: 26 }}
                className="popover absolute left-0 right-0 top-13 z-50 overflow-hidden rounded-xl"
              >
                <div className="flex items-center gap-2 border-b border-[var(--panel-border)] px-3 py-2">
                  <Search className="h-4 w-4 text-fg-muted" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories…" autoFocus className="w-full bg-transparent text-sm outline-none placeholder:text-fg-muted/60" />
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5">
                  {cats.length === 0 && <p className="px-3 py-4 text-center text-sm text-fg-muted">Loading…</p>}
                  {filteredGroups.map((g) => (
                    <div key={g.parent.id} className="mb-1">
                      <button type="button" onClick={() => toggle(g.parent.name)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-mono uppercase tracking-wider transition hover:bg-[var(--panel)]", has(g.parent.name) ? "text-accent" : "text-fg-muted")}>
                        {has(g.parent.name) ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-accent/50" />}
                        {g.parent.name}
                      </button>
                      <div className="flex flex-wrap gap-1.5 px-2.5 py-1">
                        {g.children.map((c) => (
                          <button key={c.id} type="button" onClick={() => toggle(c.name)} className={cn("rounded-full border px-2.5 py-1 text-xs transition", has(c.name) ? "neon-border text-accent" : "border-[var(--panel-border)] text-fg-muted hover:text-fg")}>
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {showCustom && (
                    <button type="button" onClick={() => { toggle(q.trim()); setQ(""); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-accent transition hover:bg-accent/10">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/15"><Plus className="h-3.5 w-3.5" /></span>
                      Add tag “{q.trim()}”
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
