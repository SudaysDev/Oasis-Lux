"use client";

import { motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";
import { Marquee } from "@/components/landing/Marquee";
import type { Profile } from "@/types";

const OFFERS = [
  "−90% on Xerjoff Naxos · VIP drop",
  "Free delivery in Dushanbe over 300 сомонӣ",
  "Double loyalty points this weekend",
  "New Cartier Tank Solaire just landed",
  "Use OASIS20 for 20% off your next order",
];

export function GreetingBanner({ profile }: { profile: Profile }) {
  const name = profile.fullName?.trim() || `@${profile.username}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(circle at 85% 10%, rgba(34,211,238,0.16), transparent 55%)" }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="neon-text flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Welcome back
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{name}</h1>
          <p className="mt-1 font-mono text-xs text-fg-muted">{profile.phone}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-accent">
          <Crown className="h-3.5 w-3.5" /> {profile.loyaltyTier} member
        </span>
      </div>

      <div className="relative mt-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] py-3">
        <Marquee items={OFFERS} duration={26} />
      </div>
    </motion.div>
  );
}
