"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Ticket, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAppDispatch } from "@/store/hooks";
import { clearPromo, clearPromoLock } from "@/store";
import { promoShort, PROMO_STORAGE_KEY, PROMO_LOCK_KEY } from "@/lib/promo-codes";
import { usePromo } from "@/hooks/usePromo";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";

/** Humanise a remaining duration: "2d 3h" / "5h 12m" / "08:30". */
function fmtRemaining(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Left-sidebar promo indicator: shows whether a promo code is active, and lets you apply one. */
export function PromoStatus({ open }: { open: boolean }) {
  const dispatch = useAppDispatch();
  const { t } = useT();
  const { money } = useMoney();
  const { promo, apply: applyCode, deactivate } = usePromo();
  const code = promo.code;
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // the lock window is the binding period (active promo, if any, ends with it)
  const lockMs = promo.lockedUntil ? new Date(promo.lockedUntil).getTime() : 0;
  const remainingMs = lockMs ? Math.max(0, lockMs - now) : 0;

  // tick while a promo / lock is live
  useEffect(() => {
    if (!code && !lockMs) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [code, lockMs]);

  // when the period passes, drop the active promo AND release the lock
  useEffect(() => {
    if (lockMs && now >= lockMs) {
      dispatch(clearPromo());
      dispatch(clearPromoLock());
      try { localStorage.removeItem(PROMO_STORAGE_KEY); localStorage.removeItem(PROMO_LOCK_KEY); } catch {}
      toast("Промо-период завершён — можно выбрать новый", { icon: "⌛" });
    }
  }, [now, lockMs, dispatch]);

  const apply = () => {
    if (applyCode(input)) {
      setInput("");
      setEditing(false);
    }
  };

  const remove = () => deactivate();

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
            <p className="truncate text-sm font-bold text-success">{code} <span className="font-mono text-[11px]">{promoShort(promo, money)}</span></p>
            {lockMs > 0 && (
              <p className="flex items-center gap-1 font-mono text-[10px] text-fg-muted">
                <Clock className="h-2.5 w-2.5" /> {fmtRemaining(remainingMs)} left
              </p>
            )}
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
          {promo.lockedCode && lockMs > 0 && (
            <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-amber-400">
              <Clock className="h-2.5 w-2.5" /> Locked to {promo.lockedCode} · {fmtRemaining(remainingMs)} left
            </p>
          )}
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
