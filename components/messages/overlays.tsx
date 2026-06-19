"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Portal target — only on the client, after mount (avoids SSR mismatch). */
function usePortal(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => setEl(document.body), []);
  return el;
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      onClick={onClick}
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  );
}

/** Centered dialog — for confirmations (block, delete…). */
export function Modal({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const portal = usePortal();
  useEscape(open, onClose);
  if (!portal) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center p-4">
          <Backdrop onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn("popover relative z-10 w-full max-w-sm rounded-3xl p-5", className)}
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    portal,
  );
}

/** Bottom sheet on mobile, centered card on ≥sm — for action menus. */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const portal = usePortal();
  useEscape(open, onClose);
  if (!portal) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
          <Backdrop onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="popover relative z-10 w-full rounded-t-3xl p-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-3xl sm:p-3"
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-[var(--panel-border)] sm:hidden" />
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    portal,
  );
}

/** Full-screen image viewer. */
export function Lightbox({ src, onClose }: { src: string | null; onClose: () => void }) {
  const portal = usePortal();
  useEscape(!!src, onClose);
  if (!portal) return null;
  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-[90] grid place-items-center bg-black/90 p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={src}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    portal,
  );
}

/** A tappable row inside a Sheet. */
export function SheetItem({
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
        "flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition hover:bg-[var(--panel)]",
        danger ? "text-danger" : "text-fg",
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--panel)]">{icon}</span>
      {label}
    </button>
  );
}
