"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { motion, useMotionTemplate, useMotionValue, useSpring } from "framer-motion";
import { ArrowRight, MousePointer2, Sparkles } from "lucide-react";
import { Hero3D } from "./Hero3D";

const MINI = [
  { v: "18.4k+", l: "Decants delivered" },
  { v: "120+", l: "Premium brands" },
  { v: "14", l: "Cities covered" },
];

export function Hero() {
  const mx = useMotionValue(50);
  const my = useMotionValue(40);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(560px circle at ${sx}% ${sy}%, rgba(34,211,238,0.14), transparent 60%)`;

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  return (
    <section
      onMouseMove={onMove}
      className="relative flex min-h-screen items-center overflow-hidden px-6 pb-16 pt-28 sm:px-10"
    >
      <div className="grid-mesh pointer-events-none absolute inset-0 opacity-[0.16]" />
      <motion.div className="pointer-events-none absolute inset-0" style={{ background: spotlight }} />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Tajikistan · Realtime Luxury
          </span>
          <h1 className="mt-6 text-5xl font-black uppercase leading-[0.9] tracking-tight sm:text-6xl xl:text-7xl">
            Distilled
            <br />
            <span className="neon-text text-accent">Luxury.</span>
            <br />
            Realtime <span className="text-stroke">Delivery.</span>
          </h1>
          <p className="mt-6 max-w-md text-base text-fg-muted">
            Decant perfumes, watches &amp; premium glasses — delivered across Tajikistan with a live 3D map,
            a Gemini AI concierge and instant Telegram alerts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="neon-border group flex items-center gap-2 rounded-full bg-gradient-to-r from-accent/25 to-accent-2/25 px-7 py-3.5 font-mono text-sm uppercase tracking-[0.15em] transition hover:from-accent/40 hover:to-accent-2/40"
            >
              Enter the grid
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/catalog"
              className="glass flex items-center rounded-full px-7 py-3.5 font-mono text-sm uppercase tracking-[0.15em] transition hover:neon-border"
            >
              Explore catalog
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-8">
            {MINI.map((m) => (
              <div key={m.l}>
                <p className="text-2xl font-black text-fg">{m.v}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">{m.l}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative h-[380px] sm:h-[460px] lg:h-[560px]"
        >
          <div className="glass absolute inset-6 rounded-[2.5rem] opacity-60" />
          <div className="absolute inset-0">
            <Hero3D />
          </div>
          <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-muted">
            <MousePointer2 className="h-3 w-3" /> drag to rotate
          </span>
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-muted"
        animate={{ y: [0, 8, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.8 }}
      >
        ↓ scroll
      </motion.div>
    </section>
  );
}
