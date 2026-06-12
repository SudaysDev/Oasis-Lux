"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CreditCard, Heart, LogOut, Package, Settings, User } from "lucide-react";
import { logout } from "@/app/actions/session";
import { useT } from "@/hooks/useT";
import { formatTjPhone } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { PlanBadge, VerifiedBadge } from "./Badges";
import type { Profile } from "@/types";

const ITEMS = [
  { key: "menu.profile", href: "/profile", icon: User },
  { key: "menu.orders", href: "/orders", icon: Package },
  { key: "menu.favorites", href: "/favorites", icon: Heart },
  { key: "menu.wallet", href: "/billing", icon: CreditCard },
  { key: "menu.settings", href: "/settings", icon: Settings },
];

const PLAN_LABEL: Record<Profile["plan"], string> = {
  free: "Free plan",
  pro: "Pro Studio",
  elite: "Elite",
};

export function ProfileMenu({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="rounded-full ring-2 ring-transparent transition hover:ring-accent/50"
      >
        <Avatar src={profile.avatarUrl} name={profile.username} size={40} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="fixed inset-0 z-40 cursor-default"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="popover absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl p-2"
            >
              {/* identity header */}
              <Link
                href="/profile"
                onClick={close}
                className="flex items-center gap-3 rounded-xl p-3 transition hover:bg-[var(--panel)]"
              >
                <Avatar src={profile.avatarUrl} name={profile.username} size={44} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-semibold">
                      {profile.fullName || `@${profile.username}`}
                    </span>
                    {profile.isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </div>
                  <p className="truncate font-mono text-[11px] text-fg-muted">{formatTjPhone(profile.phone)}</p>
                </div>
              </Link>

              <div className="my-1.5 flex items-center justify-between px-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
                  {profile.plan === "free" ? t("menu.freePlan") : PLAN_LABEL[profile.plan]}
                </span>
                {profile.plan === "free" ? (
                  <Link href="/billing" onClick={close} className="font-mono text-[10px] uppercase tracking-wider text-accent hover:underline">
                    {t("menu.upgrade")}
                  </Link>
                ) : (
                  <PlanBadge plan={profile.plan} />
                )}
              </div>

              <div className="my-1 h-px bg-[var(--panel-border)]" />

              <nav className="flex flex-col">
                {ITEMS.map((it) => {
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href + it.key}
                      href={it.href}
                      onClick={close}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg-muted transition hover:bg-[var(--panel)] hover:text-fg"
                    >
                      <Icon className="h-4 w-4" /> {t(it.key)}
                    </Link>
                  );
                })}
              </nav>

              <div className="my-1 h-px bg-[var(--panel-border)]" />

              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger transition hover:bg-danger/10"
                >
                  <LogOut className="h-4 w-4" /> {t("menu.logout")}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
