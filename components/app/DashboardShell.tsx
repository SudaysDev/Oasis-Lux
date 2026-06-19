"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Menu, ShoppingBag } from "lucide-react";
import { Sidebar } from "@/components/app/Sidebar";
import { SearchBar } from "@/components/app/SearchBar";
import { LanguageSwitcher } from "@/components/app/LanguageSwitcher";
import { ThemeToggle } from "@/components/auth/ThemeToggle";
import { ParticleField } from "@/components/fx/ParticleField";
import { HydrateAuth } from "@/components/system/HydrateAuth";
import { ProfileMenu } from "@/components/profile/ProfileMenu";
import { NotificationsMenu } from "@/components/profile/NotificationsMenu";
import { OasisHelper } from "@/components/ai/OasisHelper";
import { useAppSelector } from "@/store/hooks";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

export function DashboardShell({
  profile,
  children,
  flush = false,
}: {
  profile: Profile;
  children: ReactNode;
  /** Full-bleed mode: no main padding, viewport-locked height, no page scroll,
      no floating helper. Used by chrome-like pages (e.g. Messages). */
  flush?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();

  return (
    <div className="relative min-h-screen bg-bg text-fg">
      <HydrateAuth profile={profile} />
      <ParticleField className="pointer-events-none fixed inset-0 z-0" quantity={30} />

      {/* desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen border-r border-[var(--panel-border)] bg-bg-elev/70 backdrop-blur-xl lg:block">
        <Sidebar profile={profile} />
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden">
            <motion.button
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-screen border-r border-[var(--panel-border)] bg-bg-elev"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <Sidebar profile={profile} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "relative z-10 transition-all",
          sidebarOpen ? "lg:pl-60" : "lg:pl-[72px]",
          flush && "flex h-dvh flex-col overflow-hidden",
        )}
      >
        <header
          className={cn(
            "z-30 flex items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-bg/70 px-5 py-3 backdrop-blur-xl sm:px-8",
            flush ? "shrink-0" : "sticky top-0",
          )}
        >
          <div className="flex flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="glass grid h-10 w-10 shrink-0 place-items-center rounded-full lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <SearchBar className="hidden w-full max-w-xl sm:block" />
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
            <NotificationsMenu />
            <LanguageSwitcher />
            <ThemeToggle />
            <ProfileMenu profile={profile} />
          </div>
        </header>

        <main className={flush ? "min-h-0 flex-1 overflow-hidden" : "px-5 pb-24 pt-6 sm:px-8"}>{children}</main>
      </div>

      {!flush && <OasisHelper profile={profile} />}
    </div>
  );
}
