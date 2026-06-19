"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  Flag,
  Gauge,
  Layers,
  LayoutGrid,
  LogOut,
  Menu,
  ShieldHalf,
  Store,
  Terminal,
  Ticket,
  Truck,
  Users,
  UserX,
} from "lucide-react";
import { BRAND } from "@/lib/config";
import { logoutAction } from "@/app/(auth)/actions";
import { CubeTrail } from "./CubeTrail";
import { GreenSweeps } from "./GreenSweeps";
import type { Profile } from "@/types";

const NAV: { href: string; label: string; Icon: typeof LayoutGrid; hint: string }[] = [
  { href: "/admin", label: "Control Room", Icon: LayoutGrid, hint: "Overview" },
  { href: "/admin/stats", label: "Statistics", Icon: BarChart3, hint: "Everything, measured" },
  { href: "/admin/users", label: "Users", Icon: Users, hint: "Every account ever" },
  { href: "/admin/products", label: "Inventory", Icon: Boxes, hint: "Catalog control" },
  { href: "/admin/catalog", label: "Taxonomy", Icon: Layers, hint: "Categories · brands · colors" },
  { href: "/admin/promo", label: "Promo Engine", Icon: Ticket, hint: "AI promo patterns" },
  { href: "/admin/logistics", label: "Logistics", Icon: Truck, hint: "Live deliveries" },
  { href: "/admin/control", label: "Full Control", Icon: Terminal, hint: "Command console" },
  { href: "/admin/bans", label: "Black List", Icon: UserX, hint: "Bans & restrictions" },
  { href: "/admin/reports", label: "Reports", Icon: Flag, hint: "Abuse & moderation" },
  { href: "/admin/copilot", label: "Copilot", Icon: Bot, hint: "Admin AI" },
];

const GREEN = "#22ff88";

export function AdminShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Style the page-level (window) scrollbar with the admin theme while mounted.
  useEffect(() => {
    document.documentElement.classList.add("admin-active");
    return () => document.documentElement.classList.remove("admin-active");
  }, []);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const SidebarBody = (
    <div className="flex h-full flex-col">
      {/* operator identity */}
      <Link href="/admin" className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
        <Image src={BRAND.icon} alt={BRAND.name} width={36} height={36} className="rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-black tracking-tight">{BRAND.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: GREEN }}>
            Admin Grid
          </p>
        </div>
      </Link>

      <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(({ href, label, Icon, hint }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition"
              style={
                active
                  ? { background: "rgba(34,255,136,0.08)", boxShadow: "inset 0 0 0 1px rgba(34,255,136,0.25)" }
                  : undefined
              }
            >
              {active && (
                <motion.span
                  layoutId="admin-active"
                  className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ background: GREEN, boxShadow: `0 0 12px ${GREEN}` }}
                />
              )}
              <Icon
                className="h-4 w-4 shrink-0 transition"
                style={{ color: active ? GREEN : undefined }}
              />
              <span className="min-w-0">
                <span
                  className="block text-sm font-semibold leading-tight"
                  style={{ color: active ? GREEN : undefined }}
                >
                  {label}
                </span>
                <span className="block truncate font-mono text-[10px] text-fg-muted">{hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <Link
          href="/home"
          className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-muted transition hover:text-fg hover:bg-white/5"
        >
          <Store className="h-4 w-4" /> Exit to storefront
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger transition hover:bg-danger/10"
          >
            <LogOut className="h-4 w-4" /> Terminate session
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="admin-scope relative min-h-screen bg-[#05070b] text-fg">
      <CubeTrail />
      <GreenSweeps />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,255,136,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(34,255,136,0.6) 1px,transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-white/5 bg-[#070a10]/80 backdrop-blur-xl lg:block">
        {SidebarBody}
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden">
            <motion.button
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-white/5 bg-[#070a10]"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {SidebarBody}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-10 lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/5 bg-[#05070b]/80 px-5 py-3 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/10 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em]"
              style={{ borderColor: "rgba(34,255,136,0.3)", color: GREEN }}
            >
              <Activity className="h-3.5 w-3.5" /> System online
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 font-mono text-[11px] text-fg-muted sm:flex">
              <Gauge className="h-3.5 w-3.5" style={{ color: GREEN }} /> root access
            </span>
            <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1 pl-3 pr-1.5">
              <div className="text-right leading-tight">
                <p className="text-xs font-bold">{profile.username}</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: GREEN }}>
                  Admin
                </p>
              </div>
              <span
                className="grid h-8 w-8 place-items-center rounded-full"
                style={{ background: "rgba(34,255,136,0.12)", color: GREEN }}
              >
                <ShieldHalf className="h-4 w-4" />
              </span>
            </div>
          </div>
        </header>

        <main className="px-5 pb-24 pt-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
