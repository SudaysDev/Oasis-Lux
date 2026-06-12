"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { SOCIAL_META } from "@/lib/auth/shared";
import { SOCIAL_ICONS } from "./BrandIcons";
import type { SocialPlatform } from "@/types";

type Props = {
  /** Open for this platform, or null when closed. */
  platform: SocialPlatform | null;
  initialValue: string;
  onSave: (platform: SocialPlatform, value: string) => void;
  onRemove: (platform: SocialPlatform) => void;
  onClose: () => void;
};

export function NicknameModal({ platform, initialValue, onSave, onRemove, onClose }: Props) {
  return (
    <AnimatePresence>
      {platform && (
        // key by platform: remounting re-seeds the input from initialValue (no setState-in-effect)
        <Dialog
          key={platform}
          platform={platform}
          initialValue={initialValue}
          onSave={onSave}
          onRemove={onRemove}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function Dialog({
  platform,
  initialValue,
  onSave,
  onRemove,
  onClose,
}: {
  platform: SocialPlatform;
  initialValue: string;
  onSave: (platform: SocialPlatform, value: string) => void;
  onRemove: (platform: SocialPlatform) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 70);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const meta = SOCIAL_META[platform];
  const Icon = SOCIAL_ICONS[platform];

  const commit = () => {
    const v = value.trim().replace(/^[@+\s]+/, "");
    if (!v) return;
    onSave(platform, v);
  };

  return (
    <motion.div
      className="fixed inset-0 z-60 grid place-items-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        className="glass relative w-full max-w-sm rounded-2xl p-6"
        style={{ boxShadow: `0 0 50px ${meta.accent}44`, borderColor: `${meta.accent}55` }}
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-fg-muted transition hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <span
            className="grid h-12 w-12 place-items-center rounded-xl"
            style={{ background: `${meta.accent}22`, color: meta.accent }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-muted">
              Link identity
            </p>
            <p className="text-lg font-semibold">{meta.label}</p>
          </div>
        </div>

        <div
          className="glass flex items-center gap-2 rounded-xl px-3 py-3 transition focus-within:neon-border"
          style={{ "--accent": meta.accent, "--accent-glow": `${meta.accent}66` } as CSSProperties}
        >
          <span className="font-mono text-sm text-fg-muted">{meta.prefix}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
            placeholder={meta.placeholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-fg-muted/50"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={commit}
            disabled={!value.trim()}
            className="neon-border flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition enabled:hover:scale-[1.02] disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Save handle
          </button>
          {initialValue && (
            <button
              type="button"
              onClick={() => onRemove(platform)}
              className="glass rounded-xl px-4 py-2.5 text-sm text-danger transition hover:bg-danger/10"
            >
              Unlink
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
