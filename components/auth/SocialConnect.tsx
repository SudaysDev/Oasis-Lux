"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { SOCIAL_ORDER, SOCIAL_META } from "@/lib/auth/shared";
import { SOCIAL_ICONS } from "./BrandIcons";
import { NicknameModal } from "./NicknameModal";
import { cn } from "@/lib/utils";
import type { Socials, SocialPlatform } from "@/types";

type Props = {
  socials: Socials;
  onChange: (next: Socials) => void;
  variant?: "orbit" | "compact";
  className?: string;
};

export function SocialConnect({ socials, onChange, variant = "orbit", className }: Props) {
  const [open, setOpen] = useState<SocialPlatform | null>(null);

  const save = (p: SocialPlatform, v: string) => {
    onChange({ ...socials, [p]: v });
    setOpen(null);
  };
  const remove = (p: SocialPlatform) => {
    const next = { ...socials };
    delete next[p];
    onChange(next);
    setOpen(null);
  };

  return (
    <>
      <div
        className={cn(
          variant === "orbit" ? "grid grid-cols-2 gap-4 sm:gap-5" : "flex flex-wrap gap-2.5",
          className,
        )}
      >
        {SOCIAL_ORDER.map((p, i) => {
          const meta = SOCIAL_META[p];
          const Icon = SOCIAL_ICONS[p];
          const handle = socials[p];
          const connected = Boolean(handle);

          if (variant === "compact") {
            return (
              <button
                key={p}
                type="button"
                onClick={() => setOpen(p)}
                title={connected ? `${meta.prefix}${handle}` : `Connect ${meta.label}`}
                className={cn(
                  "glass relative grid h-12 w-12 place-items-center rounded-xl transition hover:scale-105",
                  connected && "neon-border",
                )}
                style={connected ? { color: meta.accent } : undefined}
              >
                <Icon className="h-5 w-5" />
                {connected && (
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-success text-[10px] text-black">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            );
          }

          return (
            <motion.div
              key={p}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: [0, -8, 0] }}
              transition={{
                opacity: { duration: 0.5, delay: i * 0.08 },
                y: { duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.2 },
              }}
            >
              <motion.button
                type="button"
                onClick={() => setOpen(p)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "group glass relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl p-4 transition-colors",
                  connected && "neon-border",
                )}
                style={
                  {
                    "--accent": meta.accent,
                    "--accent-glow": `${meta.accent}55`,
                  } as CSSProperties
                }
              >
                {/* interactivity hint: pulsing rings (only while not yet connected) */}
                {!connected && (
                  <>
                    <span className="ripple-ring" style={{ borderColor: `${meta.accent}66` }} />
                    <span
                      className="ripple-ring"
                      style={{ borderColor: `${meta.accent}44`, animationDelay: "1.2s" }}
                    />
                  </>
                )}
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl transition-transform group-hover:scale-110"
                  style={{ background: `${meta.accent}1f`, color: meta.accent }}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className="text-center">
                  <span className="block text-sm font-medium">{meta.label}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-fg-muted">
                    {connected ? `${meta.prefix}${handle}` : "tap to link"}
                  </span>
                </span>
                <span
                  className={cn(
                    "absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full text-[10px] transition",
                    connected ? "bg-success text-black" : "glass text-fg-muted",
                  )}
                >
                  {connected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </span>
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      <NicknameModal
        platform={open}
        initialValue={open ? socials[open] ?? "" : ""}
        onSave={save}
        onRemove={remove}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
