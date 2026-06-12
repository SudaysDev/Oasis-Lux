"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Bell, Bot, MessageSquare, Package, Star, Ticket } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { loadNotifications, markAllNotificationsRead } from "@/lib/data/profile-mutations";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types";

const ICON: Record<NotificationType, typeof Bell> = {
  order: Package,
  ai: Bot,
  system: Bell,
  promo: Ticket,
  message: MessageSquare,
  review: Star,
};

export function NotificationsMenu() {
  const { profile } = useAuth();
  const userId = profile?.id;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const list = await loadNotifications(getBrowserClient(), userId);
      if (!cancelled) setItems(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markRead = () => {
    if (!userId || unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllNotificationsRead(getBrowserClient(), userId).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="glass relative grid h-10 w-10 place-items-center rounded-full text-fg-muted transition hover:text-accent"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white shadow-[0_0_10px_var(--accent-glow)]">
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="popover absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--panel-border)] px-4 py-3">
                <span className="text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markRead}
                    className="font-mono text-[10px] uppercase tracking-wider text-accent hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="grid place-items-center gap-2 px-6 py-12 text-center">
                    <Bell className="h-7 w-7 text-fg-muted/50" />
                    <p className="text-sm text-fg-muted">No notifications yet</p>
                  </div>
                ) : (
                  items.map((n) => {
                    const Icon = ICON[n.type] ?? Bell;
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex gap-3 border-b border-[var(--panel-border)] px-4 py-3 transition hover:bg-[var(--panel)]",
                          !n.read && "bg-accent/5",
                        )}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          {n.body && <p className="text-xs text-fg-muted">{n.body}</p>}
                          <p className="mt-0.5 font-mono text-[10px] text-fg-muted/70">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
