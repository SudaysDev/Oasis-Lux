"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { PLAN_BY_KEY } from "@/lib/plans";
import { formatPrice } from "@/lib/utils";

/** Warning / paywall modal shown when a Free user opens a Pro-only feature. */
export function ProGate({ open, onClose, feature }: { open: boolean; onClose: () => void; feature: string }) {
  const router = useRouter();
  const pro = PLAN_BY_KEY.pro;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-60 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="popover relative w-full max-w-md overflow-hidden rounded-2xl p-7 text-center"
          >
            <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:text-fg">
              <X className="h-4 w-4" />
            </button>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-accent/30 to-accent-2/30 text-accent">
              <Sparkles className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-black">{feature} is a Pro feature</h2>
            <p className="mt-2 text-sm text-fg-muted">
              Upgrade to <strong className="text-fg">Pro Studio</strong> to unlock the full Gemini AI Assistant,
              AI listing generation, unlimited listings and more — from {formatPrice(pro.priceMonthly)}/mo.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-3 text-sm text-fg-muted transition hover:text-fg">
                Maybe later
              </button>
              <button
                type="button"
                onClick={() => router.push("/billing?plan=pro")}
                className="neon-border flex-1 rounded-xl bg-gradient-to-r from-accent/30 to-accent-2/30 px-4 py-3 text-sm font-semibold transition hover:from-accent/45 hover:to-accent-2/45"
              >
                Upgrade to Pro
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
