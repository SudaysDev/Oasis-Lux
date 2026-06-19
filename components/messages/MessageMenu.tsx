"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { QUICK_REACTIONS } from "./MessageItem";

const MENU_W = 224;

export interface MessageMenuProps {
  open: boolean;
  anchor: DOMRect | null;
  mine: boolean;
  /** emoji this message already carries from me (to highlight) */
  reactedSet: Set<string>;
  onClose: () => void;
  onReact: (emoji: string) => void;
  children: ReactNode; // the action rows
}

/** Telegram-style compact context menu: a reaction pill above a small action
    card, anchored next to the tapped message (flips to stay on screen). */
export function MessageMenu({ open, anchor, mine, reactedSet, onClose, onReact, children }: MessageMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const el = ref.current;
    const mw = el?.offsetWidth || MENU_W;
    const mh = el?.offsetHeight || 280;
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = mine ? anchor.right - mw : anchor.left;
    left = Math.max(pad, Math.min(left, vw - mw - pad));
    let top = anchor.bottom + 8;
    if (top + mh > vh - pad) top = Math.max(pad, anchor.top - mh - 8);
    setPos({ left, top });
  }, [open, anchor, mine]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && anchor && (
        <>
          <motion.button
            aria-label="Close"
            onClick={onClose}
            className="fixed inset-0 z-[78] cursor-default bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={ref}
            className="fixed z-[80] w-56"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              transformOrigin: mine ? "top right" : "top left",
              visibility: pos ? "visible" : "hidden",
            }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
          >
            {/* reaction pill */}
            <div className="popover mb-2 flex items-center gap-0.5 rounded-full p-1">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onReact(e)}
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-lg transition hover:scale-125 hover:bg-[var(--panel)]",
                    reactedSet.has(e) && "bg-accent/15",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            {/* action card */}
            <div className="popover overflow-hidden rounded-2xl py-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function MenuRow({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-[var(--panel)]",
        danger ? "text-danger" : "text-fg",
      )}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center">{icon}</span>
      {label}
    </button>
  );
}
