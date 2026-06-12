"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import toast from "react-hot-toast";
import { getBrowserClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/data/profile-mutations";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { PlanDef } from "@/lib/plans";

/** Mock subscription checkout with an interactive 3D card that flips on CVV. */
export function PlanCheckout({
  plan,
  userId,
  onClose,
  onPaid,
}: {
  plan: PlanDef;
  userId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [paying, setPaying] = useState(false);

  const fmtNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const valid = number.replace(/\s/g, "").length >= 16 && name.trim() && expiry.length === 5 && cvv.length >= 3;

  const pay = async () => {
    if (!valid) return toast.error("Fill in the card details");
    setPaying(true);
    try {
      await new Promise((r) => setTimeout(r, 1400)); // mock gateway authorization
      await updateProfile(getBrowserClient(), userId, { plan: plan.key });
      toast.success(`${plan.name} activated ✦`);
      onPaid();
      router.refresh();
    } catch {
      toast.error("Payment failed — try again");
      setPaying(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-60 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ scale: 0.94, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="popover relative w-full max-w-md overflow-hidden rounded-2xl p-6"
        >
          <button type="button" onClick={onClose} className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-fg-muted transition hover:text-fg">
            <X className="h-4 w-4" />
          </button>

          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-muted">Subscribe</p>
          <h2 className="mt-1 text-2xl font-black">{plan.name}</h2>
          <p className="text-sm text-fg-muted">{formatPrice(plan.priceMonthly)} / month · cancel anytime</p>

          {/* interactive card */}
          <div className="mt-5 [perspective:1200px]">
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="relative h-44 w-full [transform-style:preserve-3d]"
            >
              {/* front */}
              <div
                className="absolute inset-0 flex flex-col justify-between rounded-2xl p-5 text-white [backface-visibility:hidden]"
                style={{ background: `linear-gradient(135deg, ${plan.accent}, #0a0e18)` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-widest opacity-80">OASIS LUX</span>
                  <span className="h-6 w-9 rounded bg-white/25" />
                </div>
                <p className="font-mono text-lg tracking-[0.15em]">{number || "•••• •••• •••• ••••"}</p>
                <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider">
                  <span className="truncate">{name || "CARDHOLDER"}</span>
                  <span>{expiry || "MM/YY"}</span>
                </div>
              </div>
              {/* back */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0a0e18] to-[#1a2030] p-5 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="mt-3 h-9 w-full bg-black/60" />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <span className="font-mono text-[10px] uppercase opacity-70">CVV</span>
                  <span className="rounded bg-white px-3 py-1 font-mono text-sm text-black">{cvv || "•••"}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* inputs */}
          <div className="mt-5 space-y-3">
            <input value={number} onChange={(e) => setNumber(fmtNumber(e.target.value))} inputMode="numeric" placeholder="Card number" className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
            <input value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="Cardholder name" className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <input value={expiry} onChange={(e) => setExpiry(fmtExpiry(e.target.value))} inputMode="numeric" placeholder="MM/YY" className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none" />
              <input
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                onFocus={() => setFlipped(true)}
                onBlur={() => setFlipped(false)}
                inputMode="numeric"
                placeholder="CVV"
                className="field w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={pay}
            disabled={paying}
            className={cn(
              "neon-border mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent/30 to-accent-2/30 px-6 py-3.5 text-sm font-semibold transition hover:from-accent/45 hover:to-accent-2/45 disabled:opacity-60",
            )}
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {paying ? "Authorizing…" : `Pay ${formatPrice(plan.priceMonthly)} / mo`}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-fg-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-success" /> Demo checkout — no real charge is made
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function PlanFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span className="text-fg-muted">{text}</span>
    </li>
  );
}
