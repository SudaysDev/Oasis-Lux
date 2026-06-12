"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { ProductArt } from "./ProductArt";
import { SectionHeader } from "./SectionHeader";
import type { ProductType } from "@/types";

const CATS: { type: ProductType; title: string; desc: string; hue: number }[] = [
  { type: "perfume", title: "Decant Perfumes", desc: "2ml–100ml splits of niche & designer houses. Pay for the scent, not the bottle.", hue: 20 },
  { type: "watch", title: "Watches", desc: "Automatic, quartz & G-Shock — homages to icons and the real thing.", hue: 190 },
  { type: "glasses", title: "Premium Glasses", desc: "Sunglasses & optical frames from Ray-Ban, Oakley, Gucci and beyond.", hue: 320 },
];

export function CategoriesSection() {
  return (
    <section className="relative px-6 py-20 sm:px-10">
      <div className="mx-auto max-w-7xl">
        <SectionHeader eyebrow="Three verticals" title="One luxury grid" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {CATS.map((c, i) => (
            <motion.div
              key={c.type}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                href={`/catalog?type=${c.type}`}
                className="group glass relative block overflow-hidden rounded-3xl p-6 transition hover:neon-border"
              >
                <div className="relative mx-auto h-52 w-full transition-transform duration-500 group-hover:scale-110">
                  <ProductArt type={c.type} uid={`cat-${c.type}`} hue={c.hue} className="h-full w-full" />
                </div>
                <h3 className="mt-4 text-xl font-bold">{c.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{c.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                  Browse <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
