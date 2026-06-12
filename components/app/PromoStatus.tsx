"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Ticket, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setPromo, clearPromo } from "@/store";
import { PROMO_CODES, PROMO_STORAGE_KEY } from "@/lib/promo-codes";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

/** Left-sidebar promo indicator: shows whether a promo code is active, and lets you apply one. */
export function PromoStatus({ open }: { open: boolean }) {
  const dispatch = useAppDispatch();
  const { t } = useT();
  const { code, discountPercent } = useAppSelector((s) => s.promo);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);

  const apply = () => {
    const c = input.trim().toUpperCase();
    if (!c) return;
    const pct = PROMO_CODES[c];
    if (pct === undefined) return toast.error("Промокод не найден");
    dispatch(setPromo({ code: c, discountPercent: pct }));
    try { localStorage.setItem(PROMO_STORAGE_KEY, JSON.stringify({ code: c, discountPercent: pct })); } catch {}
    toast.success(`Промокод ${c} активирован · −${pct}%`);
    setInput("");
    setEditing(false);
  };

  const remove = () => {
    dispatch(clearPromo());
    try { localStorage.removeItem(PROMO_STORAGE_KEY); } catch {}
  };

  if (!open) {
    return (
      <div className="grid place-items-center py-1" title={code ? `${code}` : t("promo.inactive")}>
        <span className={cn("grid h-9 w-9 place-items-center rounded-xl", code ? "bg-success/15 text-success" : "text-fg-muted")}>
          <Ticket className="h-4 w-4" />
        </span>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border px-3 py-2", code ? "border-success/40 bg-success/5" : "border-[var(--panel-border)]")}>
      {code ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-success">
              <Check className="h-3 w-3" /> {t("promo.active")}
            </p>
            <p className="truncate text-sm font-bold text-success">{code} <span className="font-mono text-[11px]">−{discountPercent}%</span></p>
          </div>
          <button onClick={remove} aria-label={t("promo.clear")} className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-fg-muted transition hover:text-danger">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-muted">
            <Ticket className="h-3 w-3" /> {t("promo.inactive")}
          </p>
          <AnimatePresence initial={false}>
            {editing ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-1.5 flex gap-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && apply()}
                  placeholder="CODE"
                  autoFocus
                  className="field w-full rounded-lg px-2 py-1 text-xs uppercase outline-none"
                />
                <button onClick={apply} className="neon-border rounded-lg px-2.5 text-xs text-accent">OK</button>
              </motion.div>
            ) : (
              <button onClick={() => setEditing(true)} className="mt-1 font-mono text-[10px] uppercase tracking-wider text-accent transition hover:underline">
                {t("promo.enter")}
              </button>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
