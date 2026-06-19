"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** A small, minimalist context menu anchored next to a trigger element — the
    same feel as the chat message menu, reusable anywhere (portal, no clipping). */
export function AnchoredMenu({
  open,
  anchor,
  onClose,
  align = "right",
  width = 180,
  children,
}: {
  open: boolean;
  anchor: DOMRect | null;
  onClose: () => void;
  align?: "left" | "right";
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const el = ref.current;
    const w = el?.offsetWidth || width;
    const h = el?.offsetHeight || 120;
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = align === "right" ? anchor.right - w : anchor.left;
    left = Math.max(pad, Math.min(left, vw - w - pad));
    let top = anchor.bottom + 6;
    if (top + h > vh - pad) top = Math.max(pad, anchor.top - h - 6);
    setPos({ left, top });
  }, [open, anchor, align, width]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && anchor && (
        <>
          <motion.button
            aria-label="Close"
            onClick={onClose}
            className="fixed inset-0 z-[78] cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            ref={ref}
            className="popover fixed z-[80] overflow-hidden rounded-2xl py-1"
            style={{
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              width,
              transformOrigin: align === "right" ? "top right" : "top left",
              visibility: pos ? "visible" : "hidden",
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 440, damping: 30 }}
            onClick={onClose}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function AnchoredItem({
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
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-[var(--panel)]",
        danger ? "text-danger" : "text-fg",
      )}
    >
      <span className="grid h-4 w-4 shrink-0 place-items-center">{icon}</span>
      {label}
    </button>
  );
}
