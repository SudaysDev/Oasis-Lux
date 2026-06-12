"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { ArrowRight, Heart, ShoppingBag } from "lucide-react";
import { ThemeToggle } from "@/components/auth/ThemeToggle";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { useAppSelector } from "@/store/hooks";
import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Showcase", href: "#showcase" },
  { label: "Features", href: "#features" },
  { label: "Coverage", href: "#coverage" },
  { label: "Catalog", href: "/catalog" },
  { label: "Contact", href: "#contact" },
];

export function LandingNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 12));

  const cartCount = useAppSelector((s) => s.cart.items.reduce((n, i) => n + i.quantity, 0));
  const favCount = useAppSelector((s) => s.favorites.ids.length);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled ? "border-b border-[var(--panel-border)] backdrop-blur-xl" : "",
      )}
      style={scrolled ? { background: "color-mix(in oklab, var(--bg) 72%, transparent)" } : undefined}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src={BRAND.icon} alt={BRAND.name} width={34} height={34} className="rounded-lg" priority />
          <span className="text-sm font-bold tracking-tight">{BRAND.name}</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted transition hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/favorites"
            aria-label="Favorites"
            className="glass relative grid h-10 w-10 place-items-center rounded-full text-fg-muted transition hover:text-danger"
          >
            <Heart className="h-4 w-4" />
            {favCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            href="/cart"
            aria-label="Cart"
            className="glass relative grid h-10 w-10 place-items-center rounded-full text-fg-muted transition hover:text-accent"
          >
            <ShoppingBag className="h-4 w-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-[0_0_10px_var(--accent-glow)]">
                {cartCount}
              </span>
            )}
          </Link>
          <LanguageSwitcher />
          <ThemeToggle />
          <Link
            href="/login"
            className="neon-border group hidden items-center gap-1.5 rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition hover:scale-105 sm:flex"
          >
            Enter
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
