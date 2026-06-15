"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Bot,
  Heart,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  PanelLeft,
  Receipt,
  Settings,
  Shield,
  Store,
  Tag,
  Ticket,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { toggleSidebar } from "@/store";
import { logout } from "@/app/actions/session";
import { BRAND } from "@/lib/config";
import { cn, formatTjPhone } from "@/lib/utils";
import { Avatar } from "@/components/profile/Avatar";
import { PlanBadge } from "@/components/profile/Badges";
import { PromoStatus } from "@/components/app/PromoStatus";
import { useT } from "@/hooks/useT";
import type { Profile } from "@/types";

const NAV = [
  { key: "nav.dashboard", href: "/home", icon: LayoutDashboard },
  { key: "nav.catalog", href: "/catalog", icon: Store },
  { key: "nav.sell", href: "/sell", icon: Tag },
  { key: "nav.ai", href: "/ai", icon: Bot },
  { key: "nav.orders", href: "/orders", icon: Package },
  { key: "nav.transactions", href: "/transactions", icon: Receipt },
  { key: "nav.favorites", href: "/favorites", icon: Heart },
  { key: "nav.messages", href: "/messages", icon: MessageSquare },
  { key: "nav.promo", href: "/promo", icon: Ticket },
  { key: "nav.settings", href: "/settings", icon: Settings },
];

export function Sidebar({ profile, onNavigate }: { profile: Profile; onNavigate?: () => void }) {
  const pathname = usePathname();
  const open = useAppSelector((s) => s.ui.sidebarOpen);
  const dispatch = useAppDispatch();
  const { t } = useT();

  const items = profile.role === "admin" ? [...NAV, { key: "nav.admin", href: "/admin", icon: Shield }] : NAV;

  return (
    <div className={cn("flex h-full flex-col gap-1 p-3 transition-all", open ? "w-60" : "w-[72px]")}>
      <div className="mb-3 flex items-center justify-between px-1">
        <Link href="/" className={cn("flex items-center gap-2.5 overflow-hidden", !open && "justify-center")}>
          <Image src={BRAND.icon} alt={BRAND.name} width={32} height={32} className="shrink-0 rounded-lg" priority />
          {open && <span className="text-sm font-bold">{BRAND.name}</span>}
        </Link>
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Collapse sidebar"
          className="hidden h-8 w-8 place-items-center rounded-lg text-fg-muted transition hover:text-accent lg:grid"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = pathname === it.href;
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              title={t(it.key)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                !open && "justify-center",
                active ? "neon-border text-accent" : "text-fg-muted hover:bg-[var(--panel)] hover:text-fg",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {open && <span className="text-sm">{t(it.key)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* account footer — avatar · name · plan · phone → /profile (ChatGPT-style) */}
      <div className="mt-auto flex flex-col gap-1">
        <PromoStatus open={open} />

        <Link
          href="/profile"
          onClick={onNavigate}
          title="My profile"
          className={cn(
            "card flex items-center gap-2.5 rounded-xl p-2 transition hover:border-accent",
            !open && "justify-center border-transparent bg-transparent p-1.5",
          )}
        >
          <Avatar src={profile.avatarUrl} name={profile.username} size={open ? 36 : 32} />
          {open && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-semibold">
                  {profile.fullName || `@${profile.username}`}
                </span>
                <PlanBadge plan={profile.plan} className="shrink-0 px-1.5 py-0 text-[8px]" />
              </div>
              <p className="truncate font-mono text-[10px] text-fg-muted">
                {profile.plan === "free" ? t("menu.freePlan") : formatTjPhone(profile.phone)}
              </p>
            </div>
          )}
        </Link>

        <form action={logout}>
          <button
            type="submit"
            title="Log out"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-fg-muted transition hover:bg-danger/10 hover:text-danger",
              !open && "justify-center",
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {open && <span className="text-sm">Log out</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
