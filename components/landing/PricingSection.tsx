"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Crown, Sparkles, Star } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { formatPrice, cn } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";

const ICON = { free: Star, pro: Sparkles, elite: Crown } as const;

export function PricingSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <SectionHeader
        center
        eyebrow="Membership"
        title="Plans & Subscriptions"
        subtitle="Start free, then upgrade to unlock the full Gemini AI suite, AI cover generation, unlimited listings and priority delivery."
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PLANS.map((plan, i) => {
          const Icon = ICON[plan.key];
          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                "glass relative flex flex-col rounded-2xl p-7",
                plan.highlight && "neon-border shadow-[0_30px_80px_-30px_var(--accent-glow)] md:-translate-y-3",
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent to-accent-2 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                  Most popular
                </span>
              )}
              <span className="grid h-12 w-12 place-items-center rounded-xl" style={{ background: `${plan.accent}22`, color: plan.accent }}>
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-2xl font-black">{plan.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{plan.tagline}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-black">{plan.priceMonthly === 0 ? "Free" : formatPrice(plan.priceMonthly)}</span>
                {plan.priceMonthly > 0 && <span className="mb-1.5 text-sm text-fg-muted">/ mo</span>}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span className="text-fg-muted">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.key === "free" ? "/register" : `/billing?plan=${plan.key}`}
                className={cn(
                  "mt-7 w-full rounded-xl px-6 py-3.5 text-center text-sm font-semibold transition",
                  plan.highlight
                    ? "neon-border bg-gradient-to-r from-accent/30 to-accent-2/30 hover:from-accent/45 hover:to-accent-2/45"
                    : "glass hover:neon-border",
                )}
              >
                {plan.key === "free" ? "Start free" : `Get ${plan.name}`}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
