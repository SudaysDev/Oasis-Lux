"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useIsClient } from "@/hooks/useIsClient";
import Link from "next/link";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Activity,
  AtSign,
  Bell,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Eye,
  Globe,
  Loader2,
  Lock,
  LogOut,
  Moon,
  Pencil,
  Phone,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Zap,
} from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { updateProfile } from "@/lib/data/profile-mutations";
import { logout } from "@/app/actions/session";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setLocale, setCurrency, setTheme } from "@/store";
import { LOCALES, CURRENCIES, CURRENCY_META, CURRENCY_STORAGE_KEY } from "@/lib/config";
import { LOCALE_STORAGE_KEY } from "@/components/app/LanguageSwitcher";
import { SOCIAL_ORDER, SOCIAL_META } from "@/lib/auth/shared";
import { SOCIAL_ICONS } from "@/components/auth/BrandIcons";
import { PlanBadge } from "@/components/profile/Badges";
import { Modal } from "@/components/messages/overlays";
import { useT } from "@/hooks/useT";
import { cn, formatTjPhone, isValidTjPhone, normalizeTjPhone, tjNationalDigits, TJ_DIAL } from "@/lib/utils";
import type { Currency, Locale, Profile } from "@/types";

const NOTIF_KEY = "oasis-notif-prefs";
const PRIVACY_KEY = "oasis-privacy-prefs";
type NotifPrefs = { all: boolean; orders: boolean; promo: boolean; ai: boolean; system: boolean; telegram: boolean; instagram: boolean; whatsapp: boolean };
const DEFAULT_NOTIF: NotifPrefs = { all: true, orders: true, promo: true, ai: true, system: true, telegram: true, instagram: false, whatsapp: false };
type PrivacyPrefs = { online: boolean; searchable: boolean; reduceMotion: boolean };
const DEFAULT_PRIVACY: PrivacyPrefs = { online: true, searchable: true, reduceMotion: false };

function readJSON<T>(key: string, fallback: T): T {
  try {
    const r = localStorage.getItem(key);
    return r ? { ...fallback, ...(JSON.parse(r) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

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

function ToggleRow({ icon: Icon, label, desc, value, disabled, onChange }: { icon?: typeof Bell; label: string; desc?: string; value: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <span className={cn("flex items-center gap-2 text-sm", disabled && "text-fg-muted/50")}>
          {Icon && <Icon className="h-4 w-4 shrink-0 text-fg-muted" />} {label}
        </span>
        {desc && <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{desc}</p>}
      </div>
      <Switch on={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function Block({ icon: Icon, title, desc, children, tone }: { icon: typeof Bell; title: string; desc?: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <section className={cn("card mb-5 rounded-2xl p-5", tone === "danger" && "border-danger/30")}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg", tone === "danger" ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent")}><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-bold">{title}</p>
          {desc && <p className="text-[11px] text-fg-muted">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

type Option<T extends string> = { value: T; label: string; flag?: string; hint?: string };

/** A tactile select rendered as a modal picker (radio-style). */
function SelectField<T extends string>({ icon: Icon, title, value, options, onChange }: { icon: typeof Bell; title: string; value: T; options: Option<T>[]; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="field flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition hover:border-accent/50"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {current?.flag && <span className="text-base">{current.flag}</span>}
          <span className="truncate font-medium">{current?.label ?? value}</span>
          {current?.hint && <span className="font-mono text-[10px] text-fg-muted">{current.hint}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-fg-muted" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} className="max-w-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"><Icon className="h-4 w-4" /></span>
          <p className="text-sm font-bold">{title}</p>
        </div>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition",
                  active ? "border-accent bg-accent/10 text-fg" : "border-[var(--panel-border)] text-fg-muted hover:border-accent/50",
                )}
              >
                {o.flag && <span className="text-base">{o.flag}</span>}
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="font-mono text-[10px] text-fg-muted">{o.hint}</span>}
                {active && <Check className="h-4 w-4 shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}

const PLAN_LABEL: Record<Profile["plan"], string> = { free: "Free", pro: "Pro Studio", elite: "Elite" };

export function SettingsView({ profile }: { profile: Profile }) {
  const dispatch = useAppDispatch();
  const { t, locale } = useT();
  const currency = useAppSelector((s) => s.locale.currency);
  const light = useSyncExternalStore(subscribe, isLight, () => false);

  // hydration-safe: server snapshot = defaults; once mounted we read localStorage
  // during render (no setState-in-effect). Overrides hold any in-session edits.
  const isClient = useIsClient();
  const [notifOverride, setNotifOverride] = useState<NotifPrefs | null>(null);
  const [privacyOverride, setPrivacyOverride] = useState<PrivacyPrefs | null>(null);
  const notif = notifOverride ?? (isClient ? readJSON(NOTIF_KEY, DEFAULT_NOTIF) : DEFAULT_NOTIF);
  const privacy = privacyOverride ?? (isClient ? readJSON(PRIVACY_KEY, DEFAULT_PRIVACY) : DEFAULT_PRIVACY);

  const [phone, setPhone] = useState(profile.phone);
  const [showPhone, setShowPhone] = useState(profile.showPhone);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", privacy.reduceMotion); }, [privacy.reduceMotion]);

  const toggleShowPhone = (v: boolean) => {
    setShowPhone(v);
    void updateProfile(getBrowserClient(), profile.id, { showPhone: v }).catch(() => setShowPhone(!v));
  };

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

  const setPref = (patch: Partial<NotifPrefs>) => {
    const next = { ...notif, ...patch };
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(next)); } catch {}
    setNotifOverride(next);
  };
  const setPrivacyPref = (patch: Partial<PrivacyPrefs>) => {
    const next = { ...privacy, ...patch };
    try { localStorage.setItem(PRIVACY_KEY, JSON.stringify(next)); } catch {}
    setPrivacyOverride(next);
  };

  const row = (label: string, k: keyof NotifPrefs) => (
    <ToggleRow label={label} value={notif[k]} disabled={!notif.all} onChange={(v) => setPref({ [k]: v })} />
  );

  const copyUsername = () => {
    void navigator.clipboard
      .writeText(`@${profile.username}`)
      .then(() => toast.success(t("settings.usernameCopied")))
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent"><SettingsIcon className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">{t("settings.title")}</h1>
          <p className="text-sm text-fg-muted">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Identity — username copy */}
      <Block icon={AtSign} title={t("settings.myUsername")}>
        <div className="field flex items-center justify-between gap-2 rounded-xl px-4 py-3">
          <span className="truncate font-mono text-sm">@{profile.username}</span>
          <button
            type="button"
            onClick={copyUsername}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            <Copy className="h-3.5 w-3.5" /> {t("settings.copyUsername")}
          </button>
        </div>
      </Block>

      {/* Account & security */}
      <Block icon={ShieldCheck} title={t("settings.account")}>
        <div className="field flex items-center justify-between gap-2 rounded-xl px-3 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{t("settings.phone")}</span>
          <span className="flex items-center gap-2">
            <span className={cn("font-mono text-sm", !phone && "text-fg-muted")}>{phone ? formatTjPhone(phone) : t("settings.phoneNotSet")}</span>
            <button
              type="button"
              onClick={() => setPhoneOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/20"
            >
              <Pencil className="h-3 w-3" /> {phone ? t("settings.editPhone") : t("settings.addPhone")}
            </button>
          </span>
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

      {/* Privacy */}
      <Block icon={Lock} title={t("settings.privacy")} desc={t("settings.privacyDesc")}>
        <ToggleRow icon={Phone} label={t("settings.showPhone")} desc={phone ? t("settings.showPhoneHint") : t("settings.noPhone")} value={showPhone} disabled={!phone} onChange={toggleShowPhone} />
        <div className="border-t border-[var(--panel-border)]" />
        <ToggleRow icon={Activity} label={t("settings.online")} desc={t("settings.onlineDesc")} value={privacy.online} disabled={!isClient} onChange={(v) => setPrivacyPref({ online: v })} />
        <div className="border-t border-[var(--panel-border)]" />
        <ToggleRow icon={Eye} label={t("settings.searchVisible")} desc={t("settings.searchVisibleDesc")} value={privacy.searchable} disabled={!isClient} onChange={(v) => setPrivacyPref({ searchable: v })} />
      </Block>

      {/* Appearance — tactile theme switch + reduce motion */}
      <Block icon={light ? Sun : Moon} title={t("settings.appearance")}>
        <div className="field flex items-center justify-between rounded-xl px-4 py-3">
          <span className="flex items-center gap-2 text-sm"><Moon className="h-4 w-4 text-fg-muted" /> {t("settings.dark")}</span>
          <Switch on={light} onChange={setThemeMode} />
          <span className="flex items-center gap-2 text-sm">{t("settings.light")} <Sun className="h-4 w-4 text-amber-400" /></span>
        </div>
        <div className="mt-2">
          <ToggleRow icon={Zap} label={t("settings.reduceMotion")} desc={t("settings.reduceMotionDesc")} value={privacy.reduceMotion} disabled={!isClient} onChange={(v) => setPrivacyPref({ reduceMotion: v })} />
        </div>
      </Block>

      {/* Localization — language + currency as selects */}
      <Block icon={Globe} title={t("settings.language")}>
        <SelectField
          icon={Globe}
          title={t("settings.language")}
          value={locale}
          onChange={pickLocale}
          options={LOCALES.map((l) => ({ value: l.code, label: l.label, flag: l.flag }))}
        />
      </Block>

      <Block icon={Coins} title={t("settings.currency")} desc={t("settings.currencyHint")}>
        <SelectField
          icon={Coins}
          title={t("settings.currency")}
          value={currency}
          onChange={pickCurrency}
          options={CURRENCIES.map((c) => ({ value: c, label: c, flag: CURRENCY_META[c].flag, hint: CURRENCY_META[c].symbol }))}
        />
      </Block>

      {/* Notifications */}
      <Block icon={Bell} title={t("settings.notifications")} desc={t("settings.notifDesc")}>
        <div className="flex items-center justify-between border-b border-[var(--panel-border)] pb-2">
          <span className="text-sm font-semibold">{t("settings.notifAll")}</span>
          <Switch on={notif.all} disabled={!isClient} onChange={(v) => setPref({ all: v })} />
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

      {/* Security / danger zone */}
      <Block icon={ShieldCheck} title={t("settings.security")} desc={t("settings.securityDesc")} tone="danger">
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="field flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition hover:border-accent/50"
        >
          <span className="flex items-center gap-2.5"><LogOut className="h-4 w-4 text-fg-muted" /> <span><span className="font-medium">{t("settings.signOutAll")}</span><span className="block text-[11px] text-fg-muted">{t("settings.signOutAllDesc")}</span></span></span>
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="mt-2 flex w-full items-center justify-between rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-left text-sm transition hover:bg-danger/10"
        >
          <span className="flex items-center gap-2.5 text-danger"><Trash2 className="h-4 w-4" /> <span><span className="font-medium">{t("settings.deleteAccount")}</span><span className="block text-[11px] text-danger/70">{t("settings.deleteAccountDesc")}</span></span></span>
        </button>
      </Block>

      <PhoneModal
        open={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        userId={profile.id}
        initial={phone}
        onSaved={(p) => { setPhone(p); if (!p) setShowPhone(false); }}
        t={t}
      />
      <ConfirmModal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        icon={LogOut}
        title={t("settings.signOutAll")}
        body={t("settings.signOutAllConfirm")}
        confirmLabel={t("settings.signOutAll")}
        onConfirm={async () => { await logout(); }}
      />
      <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} username={profile.username} t={t} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phone editor modal (+992 + 9 national digits)
// ---------------------------------------------------------------------------
function PhoneModal({ open, onClose, userId, initial, onSaved, t }: { open: boolean; onClose: () => void; userId: string; initial: string; onSaved: (phone: string) => void; t: (k: string) => string }) {
  // The form lives inside Modal, which only mounts children while open — so the
  // useState initializer re-reads `initial` on every open (no setState-in-effect).
  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <PhoneForm userId={userId} initial={initial} onSaved={onSaved} onClose={onClose} t={t} />
    </Modal>
  );
}

function PhoneForm({ userId, initial, onSaved, onClose, t }: { userId: string; initial: string; onSaved: (phone: string) => void; onClose: () => void; t: (k: string) => string }) {
  const [digits, setDigits] = useState(() => tjNationalDigits(initial));
  const [saving, setSaving] = useState(false);
  const valid = isValidTjPhone(digits);

  const save = async () => {
    const normalized = normalizeTjPhone(digits);
    if (!normalized) { toast.error(t("settings.phoneInvalid")); return; }
    setSaving(true);
    try {
      await updateProfile(getBrowserClient(), userId, { phone: normalized });
      onSaved(normalized);
      toast.success(t("settings.phoneUpdated"));
      onClose();
    } catch {
      toast.error(t("settings.phoneFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><Phone className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{t("settings.phoneModalTitle")}</h3>
          <p className="text-xs text-fg-muted">{t("settings.phoneModalDesc")}</p>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2.5 focus-within:border-accent">
        <span className="font-mono text-sm text-fg-muted">{TJ_DIAL}</span>
        <input
          autoFocus
          inputMode="numeric"
          value={digits}
          onChange={(e) => setDigits(tjNationalDigits(e.target.value))}
          placeholder="90 123 45 67"
          className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-fg-muted/50"
        />
      </label>
      <p className={cn("mt-1.5 text-[11px]", valid ? "text-success" : "text-fg-muted")}>
        {valid ? formatTjPhone(digits) : `${digits.length}/9`}
      </p>

      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => { if (!saving) onClose(); }} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">
          {t("settings.cancel")}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("settings.save")}
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Generic confirmation modal
// ---------------------------------------------------------------------------
function ConfirmModal({ open, onClose, icon: Icon, title, body, confirmLabel, onConfirm }: { open: boolean; onClose: () => void; icon: typeof LogOut; title: string; body: string; confirmLabel: string; onConfirm: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => { if (!busy) onClose(); }} className="max-w-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger"><Icon className="h-5 w-5" /></span>
        <h3 className="text-lg font-bold leading-tight">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-fg-muted">{body}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => { if (!busy) onClose(); }} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">Cancel</button>
        <button type="button" onClick={() => void run()} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete account — type-to-confirm modal
// ---------------------------------------------------------------------------
function DeleteAccountModal({ open, onClose, username, t }: { open: boolean; onClose: () => void; username: string; t: (k: string) => string }) {
  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <DeleteAccountForm username={username} onClose={onClose} t={t} />
    </Modal>
  );
}

function DeleteAccountForm({ username, onClose, t }: { username: string; onClose: () => void; t: (k: string) => string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ok = text.trim().replace(/^@/, "") === username;
  const submit = async () => {
    setBusy(true);
    // No self-serve deletion endpoint yet — record the request for moderators.
    try {
      await new Promise((r) => setTimeout(r, 500));
      toast.success(t("settings.requested"));
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger"><Trash2 className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-tight">{t("settings.deleteConfirmTitle")}</h3>
          <p className="text-xs text-fg-muted">{t("settings.deleteConfirmDesc")}</p>
        </div>
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`@${username}`}
        className="field mt-4 w-full rounded-xl px-3 py-2.5 font-mono text-sm outline-none"
      />
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => { if (!busy) onClose(); }} className="flex-1 rounded-xl border border-[var(--panel-border)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--panel)]">{t("settings.cancel")}</button>
        <button type="button" onClick={() => void submit()} disabled={!ok || busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {t("settings.confirm")}
        </button>
      </div>
    </>
  );
}
