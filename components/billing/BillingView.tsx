"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Sparkles, Star } from "lucide-react";
import { PLANS, PLAN_RANK, type PlanDef } from "@/lib/plans";
import { formatPrice, cn } from "@/lib/utils";
import { PlanCheckout, PlanFeature } from "./PlanCheckout";
import type { Profile } from "@/types";

const ICON = { free: Star, pro: Sparkles, elite: Crown } as const;

export function BillingView({ profile }: { profile: Profile }) {
  const [checkout, setCheckout] = useState<PlanDef | null>(null);
  const current = profile.plan;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Membership</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">Choose your OASIS LUX plan</h1>
        <p className="mt-2 text-sm text-fg-muted">Unlock the full Gemini AI suite, unlimited listings and more. Cancel anytime.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {PLANS.map((plan, i) => {
          const Icon = ICON[plan.key];
          const isCurrent = plan.key === current;
          const isDowngrade = PLAN_RANK[plan.key] < PLAN_RANK[current];
          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "card relative flex flex-col rounded-2xl p-6",
                plan.highlight && "neon-border shadow-[0_24px_70px_-30px_var(--accent-glow)]",
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent to-accent-2 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                  Best value
                </span>
              )}
              <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${plan.accent}22`, color: plan.accent }}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-xl font-black">{plan.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{plan.tagline}</p>
              <div className="mt-4 flex items-end gap-1">
                <span className="text-3xl font-black">{plan.priceMonthly === 0 ? "Free" : formatPrice(plan.priceMonthly)}</span>
                {plan.priceMonthly > 0 && <span className="mb-1 text-xs text-fg-muted">/ mo</span>}
              </div>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <PlanFeature key={f} text={f} />
                ))}
              </ul>

              <button
                type="button"
                disabled={isCurrent || isDowngrade || plan.key === "free"}
                onClick={() => setCheckout(plan)}
                className={cn(
                  "mt-6 w-full rounded-xl px-6 py-3 text-sm font-semibold transition",
                  isCurrent
                    ? "border border-success/50 bg-success/10 text-success"
                    : isDowngrade || plan.key === "free"
                      ? "border border-[var(--panel-border)] text-fg-muted opacity-60"
                      : "neon-border bg-gradient-to-r from-accent/25 to-accent-2/25 text-fg hover:from-accent/40 hover:to-accent-2/40",
                )}
              >
                {isCurrent ? "Current plan" : isDowngrade ? "Included" : plan.key === "free" ? "Default" : `Get ${plan.name}`}
              </button>
            </motion.div>
          );
        })}
      </div>

      {checkout && (
        <PlanCheckout
          plan={checkout}
          userId={profile.id}
          onClose={() => setCheckout(null)}
          onPaid={() => setCheckout(null)}
        />
      )}
    </div>
  );
}
