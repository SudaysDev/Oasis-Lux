"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import confetti from "canvas-confetti";
import { Check, Clock, Copy, Gift, Lock, Sparkles, Tag, Ticket } from "lucide-react";
import toast from "react-hot-toast";
import { useMoney } from "@/hooks/useMoney";
import { usePromo } from "@/hooks/usePromo";
import { useT } from "@/hooks/useT";
import { PROMOS, promoWindowLabel, type PromoDef } from "@/lib/promo-codes";
import { cn } from "@/lib/utils";
import type { LoyaltyTier, Profile } from "@/types";

const TIERS: LoyaltyTier[] = ["Bronze", "Silver", "Gold", "Platinum"];
const TIER_POINTS = [0, 500, 1500, 4000];

function daysLeft(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const TYPE_META: Record<PromoDef["type"], { tkey: string; cls: string }> = {
  percent: { tkey: "promoPg.discount", cls: "text-accent" },
  fixed: { tkey: "promoPg.credit", cls: "text-success" },
  cashback: { tkey: "promoPg.cashback", cls: "text-accent-2" },
};

export function PromoView({ profile }: { profile: Profile }) {
  const { money } = useMoney();
  const { t } = useT();
  const { promo: activePromo, apply: applyCode, deactivate } = usePromo();
  const activeCode = activePromo.code;
  const lockedCode = activePromo.lockedCode; // truthy ⇒ an active period lock (expired locks are cleared)
  const [tab, setTab] = useState<"available" | "locked">("available");
  const [copied, setCopied] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const available = PROMOS.filter((p) => !p.locked && !p.hidden);
  const locked = PROMOS.filter((p) => p.locked && !p.hidden);

  const tierIdx = TIERS.indexOf(profile.loyaltyTier);
  const nextPoints = TIER_POINTS[Math.min(tierIdx + 1, TIERS.length - 1)];
  const tierProgress = nextPoints > 0 ? Math.min(1, profile.loyaltyPoints / nextPoints) : 1;

  const apply = (p: PromoDef) => applyCode(p.code);
  const applyCustom = () => { if (applyCode(custom)) setCustom(""); };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      confetti({ particleCount: 60, spread: 55, startVelocity: 28, scalar: 0.7, origin: { y: 0.7 } });
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1600);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-black sm:text-4xl">{t("promoPg.title")}</h1>
        <Ticket className="h-7 w-7 text-accent" />
      </div>
      <p className="mt-1 text-sm text-fg-muted">{t("promoPg.subtitle")}</p>

      {/* active promo banner */}
      <AnimatePresence>
        {activeCode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-5 flex items-center gap-3 rounded-2xl border border-success/40 bg-success/10 px-4 py-3"
          >
            <Check className="h-5 w-5 text-success" />
            <p className="flex-1 text-sm">
              <span className="font-bold text-success">{activeCode}</span> {t("promoPg.activeBanner")}
              {activePromo.expiresAt ? ` · ${t("promoPg.expires")} ${formatDistanceToNow(new Date(activePromo.expiresAt), { addSuffix: true })}` : ""}.
            </p>
            <button type="button" onClick={deactivate} className="rounded-lg px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:text-danger">
              {t("promoPg.deactivate")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* loyalty progress (unlock more coupons) */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-bg-elev p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-accent/30 to-accent-2/30 text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold">{profile.loyaltyTier} {t("promoPg.member")}</p>
            <p className="font-mono text-[11px] text-fg-muted">
              {tierIdx < TIERS.length - 1 ? `${profile.loyaltyPoints} / ${nextPoints} ${t("promoPg.toPts")} ${TIERS[tierIdx + 1]}` : t("promoPg.topTier")}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--panel-border)]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
            initial={{ width: 0 }}
            animate={{ width: `${tierProgress * 100}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* enter a code that isn't listed here (e.g. shared on social) */}
      <div className="mt-5 rounded-2xl border border-[var(--panel-border)] bg-bg-elev p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Ticket className="h-4 w-4 text-accent" /> {t("promoPg.haveCode")}
        </p>
        <div className="flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && applyCustom()}
            placeholder={t("promoPg.enterCode")}
            className="field w-full rounded-xl px-3 py-2.5 text-sm uppercase tracking-wider outline-none"
          />
          <button
            type="button"
            onClick={applyCustom}
            disabled={!custom.trim()}
            className="rounded-xl bg-gradient-to-r from-accent to-accent-2 px-5 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {t("common.activate")}
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          {lockedCode
            ? `${t("promoPg.lockedTo")} ${lockedCode} ${t("promoPg.lockedHint")}`
            : t("promoPg.socialHint")}
        </p>
      </div>

      {/* tabs */}
      <div className="mt-6 flex gap-2">
        {([["available", `${t("promoPg.available")} · ${available.length}`], ["locked", `${t("promoPg.locked")} · ${locked.length}`]] as [typeof tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn("rounded-full px-4 py-2 text-sm font-medium transition", tab === key ? "neon-border text-accent" : "card text-fg-muted hover:text-fg")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* grid */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(tab === "available" ? available : locked).map((p) => (
          <CouponCard
            key={p.code}
            promo={p}
            money={money}
            active={activeCode === p.code}
            lockedOut={Boolean(lockedCode) && lockedCode !== p.code}
            copied={copied === p.code}
            onCopy={() => void copy(p.code)}
            onApply={() => apply(p)}
            onDeactivate={deactivate}
          />
        ))}
      </div>
    </div>
  );
}

function CouponCard({
  promo, money, active, lockedOut, copied, onCopy, onApply, onDeactivate,
}: {
  promo: PromoDef;
  money: (n: number) => string;
  active: boolean;
  lockedOut: boolean; // another promo is the committed one this period
  copied: boolean;
  onCopy: () => void;
  onApply: () => void;
  onDeactivate: () => void;
}) {
  const { t } = useT();
  const left = daysLeft(promo.expiresAt);
  const meta = TYPE_META[promo.type];
  const big = promo.type === "fixed" ? money(promo.value) : `${promo.value}%`;
  const rainbow = promo.type === "percent" && promo.value >= 50;

  return (
    <motion.div
      whileHover={lockedOut ? undefined : { y: -3 }}
      className={cn(
        "relative flex overflow-hidden rounded-2xl border bg-bg-elev",
        active ? "border-accent shadow-[0_0_22px_-6px_var(--accent-glow)]" : "border-[var(--panel-border)]",
        (promo.locked || lockedOut) && "opacity-55 grayscale",
      )}
    >
      {/* ticket cut-outs */}
      <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-bg" />
      <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-bg" />

      {/* left stub — value */}
      <div className={cn("flex w-28 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-[var(--panel-border)] p-4 text-center", rainbow && "badge-rainbow")}>
        <span className={cn("text-2xl font-black leading-none", rainbow ? "text-white" : meta.cls)}>{big}</span>
        <span className={cn("font-mono text-[9px] uppercase tracking-wider", rainbow ? "text-white/90" : "text-fg-muted")}>
          {promo.type === "cashback" ? t("promoPg.back") : t(meta.tkey)}
        </span>
      </div>

      {/* body */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-wider">{promo.code}</span>
          {active && <span className="rounded-full bg-success/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-success">active</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{promo.tagline}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--panel)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fg-muted">
            <Tag className="h-2.5 w-2.5" /> {promo.scopeLabel}
          </span>
          {promo.minOrder && (
            <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-fg-muted">
              {t("promoPg.min")} {money(promo.minOrder)}
            </span>
          )}
        </div>

        {promo.locked ? (
          <div className="mt-3">
            <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
              <Lock className="h-3 w-3" /> {promo.lockHint}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--panel-border)]">
              <div className="h-full rounded-full bg-accent/60" style={{ width: `${(promo.lockProgress ?? 0) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              {lockedOut ? <Lock className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
              {lockedOut ? t("promoPg.lockedPeriod") : `${promoWindowLabel(promo)} ${t("promoPg.afterUse")}${left !== null && left > 0 ? ` · ${t("promoPg.endsIn")} ${left}d` : ""}`}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onCopy}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-2.5 py-1.5 text-xs font-medium transition hover:text-accent"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t("common.copied") : t("common.copy")}
              </button>
              {active ? (
                <button type="button" onClick={onDeactivate} className="rounded-lg bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-fg-muted transition hover:text-danger">
                  {t("common.remove")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onApply}
                  disabled={(left ?? 1) <= 0 || lockedOut}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-accent to-accent-2 px-3 py-1.5 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                >
                  <Gift className="h-3.5 w-3.5" /> {t("common.apply")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
