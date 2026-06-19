"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

const GREEN = "#22ff88";

export type Option = { value: string; label: string };

export function Select({
  value,
  onChange,
  options,
  Icon,
  className = "",
  align = "right",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  Icon?: typeof Check;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-medium text-white transition hover:border-white/25"
      >
        {Icon && <Icon className="h-3.5 w-3.5 text-white/45" />}
        <span className="flex-1 truncate text-left">{current?.label ?? "Select"}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4 text-white/50" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className={`absolute z-50 mt-2 max-h-72 min-w-[180px] overflow-y-auto rounded-xl border border-white/10 bg-[#0a0e16] p-1.5 shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
              style={{ boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px ${GREEN}22` }}
            >
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition"
                    style={on ? { background: `${GREEN}1f`, color: GREEN } : { color: "rgba(255,255,255,0.8)" }}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
                    {on && <Check className="h-3.5 w-3.5" style={{ color: GREEN }} />}
                  </button>
                );
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
