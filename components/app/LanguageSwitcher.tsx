"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Globe } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { setLocale } from "@/store";
import { LOCALES } from "@/lib/config";
import { useT } from "@/hooks/useT";
import { cn } from "@/lib/utils";
import type { Locale } from "@/types";

export const LOCALE_STORAGE_KEY = "oasis-locale";

/** Language switcher — changes the locale app-wide (Redux + localStorage + <html lang>). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const { locale } = useT();
  const [open, setOpen] = useState(false);
  const active = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]!;

  // keep <html lang> in sync with the active locale
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const pick = (code: Locale) => {
    dispatch(setLocale(code));
    try { localStorage.setItem(LOCALE_STORAGE_KEY, code); } catch {}
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        className="glass flex h-10 items-center gap-1.5 rounded-full px-3 text-fg-muted transition hover:text-accent hover:neon-border"
      >
        <Globe className="h-4 w-4" />
        <span className="text-sm">{active.flag}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="popover absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-2xl p-1.5"
            >
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => pick(l.code)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[var(--panel)]", locale === l.code && "text-accent")}
                >
                  <span className="text-base">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {locale === l.code && <Check className="h-4 w-4" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
