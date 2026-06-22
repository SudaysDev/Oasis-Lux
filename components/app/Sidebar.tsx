"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
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
import { Modal } from "@/components/messages/overlays";
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
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);

  // TikTok-style unread badge: how many people have unread messages waiting for me.
  useEffect(() => {
    const userId = profile.id;
    if (!userId) return;
    const sb = getBrowserClient();
    let cancelled = false;
    const refresh = async () => {
      const { data } = await sb.from("messages").select("conversation_id").eq("recipient_id", userId).eq("read", false);
      if (cancelled) return;
      setUnreadChats(new Set((data ?? []).map((r) => (r as { conversation_id: string }).conversation_id)).size);
    };
    void refresh();
    const ch = sb
      .channel(`sidebar-unread:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, () => void refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` }, () => void refresh())
      .subscribe();
    return () => { cancelled = true; void sb.removeChannel(ch); };
  }, [profile.id]);

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
          const badge = it.href === "/messages" ? unreadChats : 0;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              title={badge > 0 ? `${t(it.key)} · ${badge} new` : t(it.key)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                !open && "justify-center",
                active ? "neon-border text-accent" : "text-fg-muted hover:bg-[var(--panel)] hover:text-fg",
              )}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_var(--accent-glow)]">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              {open && <span className="text-sm">{t(it.key)}</span>}
              {open && badge > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
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

        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          title={t("menu.logout")}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-fg-muted transition hover:bg-danger/10 hover:text-danger",
            !open && "justify-center",
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {open && <span className="text-sm">{t("menu.logout")}</span>}
        </button>
      </div>

      {/* logout confirmation */}
      <Modal open={confirmLogout} onClose={() => setConfirmLogout(false)} className="max-w-sm">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-danger/10 text-danger"><LogOut className="h-6 w-6" /></div>
          <h3 className="mt-3 text-lg font-bold">{t("menu.logout")}?</h3>
          <p className="mt-1 text-sm text-fg-muted">You’ll need to sign in again to access your account.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setConfirmLogout(false)} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">Cancel</button>
            <form action={logout} className="flex-1">
              <button type="submit" className="w-full rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">{t("menu.logout")}</button>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
}
