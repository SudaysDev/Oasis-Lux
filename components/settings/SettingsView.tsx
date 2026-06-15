"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, Check, Coins, Globe, Moon, Settings as SettingsIcon, ShieldCheck, Sparkles, Sun } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLocale, setCurrency, setTheme } from "@/store";
import { LOCALES, CURRENCIES, CURRENCY_META, CURRENCY_STORAGE_KEY } from "@/lib/config";
import { LOCALE_STORAGE_KEY } from "@/components/app/LanguageSwitcher";
import { SOCIAL_ORDER, SOCIAL_META } from "@/lib/auth/shared";
import { SOCIAL_ICONS } from "@/components/auth/BrandIcons";
import { PlanBadge } from "@/components/profile/Badges";
import { useT } from "@/hooks/useT";
import { cn, formatTjPhone } from "@/lib/utils";
import type { Currency, Locale, Profile } from "@/types";

const NOTIF_KEY = "oasis-notif-prefs";
type NotifPrefs = { all: boolean; orders: boolean; promo: boolean; ai: boolean; system: boolean; telegram: boolean; instagram: boolean; whatsapp: boolean };
const DEFAULT_NOTIF: NotifPrefs = { all: true, orders: true, promo: true, ai: true, system: true, telegram: true, instagram: false, whatsapp: false };

function subscribe(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => o.disconnect();
}
const isLight = () => document.documentElement.classList.contains("light");

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40", on ? "bg-accent shadow-[0_0_10px_var(--accent-glow)]" : "bg-[var(--panel-border)]")}
    >
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: on ? "1.5rem" : "0.125rem" }} />
    </button>
  );
}

function NotifRow({ label, value, disabled, onChange }: { label: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={cn("text-sm", disabled && "text-fg-muted/50")}>{label}</span>
      <Switch on={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function Block({ icon: Icon, title, desc, children }: { icon: typeof Bell; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-5 rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-bold">{title}</p>
          {desc && <p className="text-[11px] text-fg-muted">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const PLAN_LABEL: Record<Profile["plan"], string> = { free: "Free", pro: "Pro Studio", elite: "Elite" };

export function SettingsView({ profile }: { profile: Profile }) {
  const dispatch = useAppDispatch();
  const { t, locale } = useT();
  const currency = useAppSelector((s) => s.locale.currency);
  const light = useSyncExternalStore(subscribe, isLight, () => false);
  const [notif, setNotif] = useState<NotifPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_NOTIF;
    try { const r = localStorage.getItem(NOTIF_KEY); return r ? { ...DEFAULT_NOTIF, ...JSON.parse(r) } : DEFAULT_NOTIF; } catch { return DEFAULT_NOTIF; }
  });

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setThemeMode = (toLight: boolean) => {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 550);
    root.classList.toggle("light", toLight);
    try { localStorage.setItem("oasis-theme", toLight ? "light" : "dark"); } catch {}
    dispatch(setTheme(toLight ? "light" : "dark"));
  };
  const pickLocale = (code: Locale) => { dispatch(setLocale(code)); try { localStorage.setItem(LOCALE_STORAGE_KEY, code); } catch {} };
  const pickCurrency = (c: Currency) => { dispatch(setCurrency(c)); try { localStorage.setItem(CURRENCY_STORAGE_KEY, c); } catch {} };
  const setPref = (patch: Partial<NotifPrefs>) =>
    setNotif((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  const row = (label: string, k: keyof NotifPrefs) => (
    <NotifRow label={label} value={notif[k]} disabled={!notif.all} onChange={(v) => setPref({ [k]: v })} />
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent"><SettingsIcon className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">{t("settings.title")}</h1>
          <p className="text-sm text-fg-muted">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Account & security */}
      <Block icon={ShieldCheck} title={t("settings.account")}>
        <div className="field flex items-center justify-between rounded-xl px-3 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("settings.phone")}</span>
          <span className="font-mono text-sm">{formatTjPhone(profile.phone)}</span>
        </div>
        <p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("settings.linked")}</p>
        <div className="flex flex-wrap gap-2">
          {SOCIAL_ORDER.map((k) => {
            const Icon = SOCIAL_ICONS[k];
            const handle = profile.socials[k];
            return (
              <span key={k} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs", handle ? "bg-success/10 text-success" : "field text-fg-muted")}>
                <Icon className="h-3.5 w-3.5" />
                {handle ? `${SOCIAL_META[k].prefix}${handle}` : SOCIAL_META[k].label}
                {handle && <Check className="h-3 w-3" />}
              </span>
            );
          })}
        </div>
        <Link href="/profile" className="mt-3 inline-block font-mono text-[10px] uppercase tracking-wider text-accent transition hover:underline">{t("settings.editProfile")} →</Link>
      </Block>

      {/* Appearance — tactile theme switch */}
      <Block icon={light ? Sun : Moon} title={t("settings.appearance")}>
        <div className="field flex items-center justify-between rounded-xl px-4 py-3">
          <span className="flex items-center gap-2 text-sm"><Moon className="h-4 w-4 text-fg-muted" /> {t("settings.dark")}</span>
          <Switch on={light} onChange={setThemeMode} />
          <span className="flex items-center gap-2 text-sm">{t("settings.light")} <Sun className="h-4 w-4 text-amber-400" /></span>
        </div>
      </Block>

      {/* Localization — language + currency */}
      <Block icon={Globe} title={t("settings.language")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LOCALES.map((l) => {
            const active = locale === l.code;
            return (
              <motion.button key={l.code} whileTap={{ scale: 0.97 }} onClick={() => pickLocale(l.code)} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition", active ? "neon-border text-accent" : "field text-fg-muted hover:text-fg")}>
                <span className="text-base">{l.flag}</span>
                <span className="flex-1 text-left">{l.label}</span>
                {active && <Check className="h-4 w-4" />}
              </motion.button>
            );
          })}
        </div>
      </Block>

      <Block icon={Coins} title={t("settings.currency")} desc={t("settings.currencyHint")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CURRENCIES.map((c) => {
            const meta = CURRENCY_META[c];
            const active = currency === c;
            return (
              <motion.button key={c} whileTap={{ scale: 0.97 }} onClick={() => pickCurrency(c)} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition", active ? "neon-border text-accent" : "field text-fg-muted hover:text-fg")}>
                <span className="text-base">{meta.flag}</span>
                <span className="flex-1 text-left leading-tight">
                  {c} <span className="font-mono text-[10px] text-fg-muted">{meta.symbol}</span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </motion.button>
            );
          })}
        </div>
      </Block>

      {/* Notifications */}
      <Block icon={Bell} title={t("settings.notifications")} desc={t("settings.notifDesc")}>
        <div className="flex items-center justify-between border-b border-[var(--panel-border)] pb-2">
          <span className="text-sm font-semibold">{t("settings.notifAll")}</span>
          <Switch on={notif.all} onChange={(v) => setPref({ all: v })} />
        </div>
        <div className="mt-1">
          {row(t("settings.notifOrders"), "orders")}
          {row(t("settings.notifPromo"), "promo")}
          {row(t("settings.notifAi"), "ai")}
          {row(t("settings.notifSystem"), "system")}
        </div>
        <p className="mb-1.5 mt-3 font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("settings.channels")}</p>
        <p className="mb-2 text-[11px] text-fg-muted">{t("settings.channelsDesc")}</p>
        {row("Telegram", "telegram")}
        {row("Instagram", "instagram")}
        {row("WhatsApp", "whatsapp")}
      </Block>

      {/* Plan & subscription */}
      <Block icon={Sparkles} title={t("settings.plan")} desc={t("settings.planDesc")}>
        <div className="field flex items-center justify-between rounded-xl px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            {PLAN_LABEL[profile.plan]}
            {profile.plan !== "free" && <PlanBadge plan={profile.plan} />}
          </span>
          <Link href="/billing" className="neon-border rounded-full px-4 py-2 text-xs font-medium text-accent transition hover:bg-accent/10">
            {profile.plan === "free" ? t("menu.upgrade") : t("settings.manage")}
          </Link>
        </div>
      </Block>
    </div>
  );
}
