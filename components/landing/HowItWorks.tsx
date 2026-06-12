"use client";

import { motion } from "framer-motion";
import { STEPS } from "@/lib/landing-data";
import { SectionHeader } from "./SectionHeader";

export function HowItWorks() {
  return (
    <section className="relative px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow="The flow" title="From craving to doorstep" />
        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass relative rounded-2xl p-6"
            >
              <span className="neon-text font-mono text-3xl font-black text-accent">{s.n}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-fg-muted">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
