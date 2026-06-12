"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { BellRing, Bot, Globe, MapPinned, ShieldCheck, Ticket } from "lucide-react";
import { FEATURES, type FeatureKey } from "@/lib/landing-data";
import { SectionHeader } from "./SectionHeader";

const ICONS: Record<FeatureKey, ComponentType<{ className?: string }>> = {
  tracking: MapPinned,
  ai: Bot,
  alerts: BellRing,
  promo: Ticket,
  secure: ShieldCheck,
  lang: Globe,
};

export function FeaturesSection() {
  return (
    <section id="features" className="relative scroll-mt-20 px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow="Why OASIS LUX" title="Built like a flagship" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = ICONS[f.key];
            return (
              <motion.div
                key={f.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group glass rounded-2xl p-6 transition hover:neon-border"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent transition group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
