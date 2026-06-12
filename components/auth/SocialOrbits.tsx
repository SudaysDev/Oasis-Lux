"use client";

import { motion } from "framer-motion";
import { SocialConnect } from "./SocialConnect";
import { cn } from "@/lib/utils";
import type { AuthMode } from "@/lib/auth/shared";
import type { Socials } from "@/types";

type Props = {
  socials: Socials;
  onChange: (next: Socials) => void;
  mode: AuthMode;
  error?: string;
};

/** Decorative, interactive left panel — the "identity layer" with floating social orbs. */
export function SocialOrbits({ socials, onChange, mode, error }: Props) {
  const count = Object.keys(socials).length;

  return (
    <div className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-center lg:gap-10 xl:p-16">
      {/* luminous wash + slowly rotating geometry */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(circle at 32% 30%, rgba(168,85,247,0.18), transparent 55%), radial-gradient(circle at 68% 64%, rgba(34,211,238,0.16), transparent 55%)",
          }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-[2.5rem] border border-white/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/5"
          animate={{ rotate: [45, -315] }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="relative">
        <p className="neon-text font-mono text-xs uppercase tracking-[0.4em] text-accent">
          Identity Layer
        </p>
        <h2 className="mt-3 text-4xl font-black uppercase leading-[0.95] tracking-tight xl:text-5xl">
          Connect
          <br />
          Identity
        </h2>
        <p className="mt-4 max-w-sm text-sm text-fg-muted">
          {mode === "register"
            ? "Link a network to claim your profile — Telegram, Instagram, TikTok or WhatsApp. At least one is required."
            : "Your linked networks are how buyers and couriers reach you across OASIS LUX."}
        </p>
      </div>

      <div className="relative max-w-md">
        <SocialConnect socials={socials} onChange={onChange} variant="orbit" />
        {mode === "register" && (
          <p
            className={cn(
              "mt-6 font-mono text-[11px] uppercase tracking-[0.2em]",
              error ? "shake text-danger" : count > 0 ? "text-success" : "text-fg-muted",
            )}
          >
            {error
              ? error
              : count > 0
                ? `${count} network${count > 1 ? "s" : ""} linked ✓`
                : "◇ connect ≥ 1 to initialize"}
          </p>
        )}
      </div>
    </div>
  );
}
