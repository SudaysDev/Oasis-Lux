"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { setTheme } from "@/store";
import { cn } from "@/lib/utils";

// Subscribe to the <html> class so the icon tracks the real theme — no setState-in-effect,
// no hydration mismatch (server snapshot = dark).
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isLightNow = () => document.documentElement.classList.contains("light");

/** Auth-page theme switch. Syncs the <html> class, localStorage, and Redux. */
export function ThemeToggle({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const light = useSyncExternalStore(subscribe, isLightNow, () => false);

  const toggle = () => {
    const next = !light;
    const root = document.documentElement;
    // crossfade colors for the duration of the switch, then drop the helper class
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 550);
    root.classList.toggle("light", next); // MutationObserver re-renders the icon
    try {
      localStorage.setItem("oasis-theme", next ? "light" : "dark");
    } catch {}
    dispatch(setTheme(next ? "light" : "dark"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark / light theme"
      className={cn(
        "glass grid h-10 w-10 place-items-center rounded-full text-fg-muted transition hover:text-accent hover:neon-border",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={light ? "moon" : "sun"}
          initial={{ rotate: -90, scale: 0, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
          className="grid place-items-center"
        >
          {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
