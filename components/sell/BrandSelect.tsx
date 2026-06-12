"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const showCustom = q.trim().length > 0 && !options.some((o) => o.toLowerCase() === q.trim().toLowerCase());

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm"
      >
        <span className="flex items-center gap-2">
          {value && (
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-[10px] font-bold text-accent">
              {value[0]?.toUpperCase()}
            </span>
          )}
          <span className={cn(!value && "text-fg-muted")}>{value || "Select a brand"}</span>
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
              className="card-strong absolute left-0 right-0 top-13 z-50 overflow-hidden rounded-xl shadow-[0_20px_60px_-20px_var(--accent-glow)]"
            >
              <div className="flex items-center gap-2 border-b border-[var(--panel-border)] px-3 py-2">
                <Search className="h-4 w-4 text-fg-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search brand…"
                  autoFocus
                  className="w-full bg-transparent text-sm outline-none placeholder:text-fg-muted/60"
                />
              </div>
              <div className="max-h-60 overflow-y-auto p-1.5">
                {filtered.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => pick(o)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-[var(--panel)]",
                      value === o && "text-accent",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/15 text-[10px] font-bold text-accent">
                      {o[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1">{o}</span>
                    {value === o && <Check className="h-4 w-4" />}
                  </button>
                ))}
                {showCustom && (
                  <button
                    type="button"
                    onClick={() => pick(q.trim())}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-accent transition hover:bg-accent/10"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/15">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                    Use “{q.trim()}”
                  </button>
                )}
                {filtered.length === 0 && !showCustom && (
                  <p className="px-3 py-4 text-center text-sm text-fg-muted">No brands found</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
