"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail, ShieldCheck, Ticket, UserCog } from "lucide-react";
import { SocialConnect } from "./SocialConnect";
import { useT } from "@/hooks/useT";
import { BRAND } from "@/lib/config";
import { MIN_PASSWORD, SOCIAL_ORDER, type AuthFormState, type AuthMode } from "@/lib/auth/shared";
import type { Socials } from "@/types";

type Props = {
  mode: AuthMode;
  /** Lifted `useActionState` from <AuthExperience> so both panels share errors. */
  formAction: (formData: FormData) => void;
  state: AuthFormState;
  pending: boolean;
  socials: Socials;
  onSocialsChange: (next: Socials) => void;
  adminEmail?: string;
};

export function AuthForm({
  mode,
  formAction,
  state,
  pending,
  socials,
  onSocialsChange,
  adminEmail,
}: Props) {
  const isRegister = mode === "register";
  const { t } = useT();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [promo, setPromo] = useState("");
  const [terms, setTerms] = useState(false);

  const socialCount = Object.keys(socials).length;
  const fe = state?.fieldErrors;

  const useAdmin = () => {
    if (!adminEmail) return;
    setEmail(adminEmail);
  };

  return (
    <div className="relative flex w-full items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        {/* brand */}
        <div className="mb-6 flex items-center gap-3">
          <Image src={BRAND.icon} alt={BRAND.name} width={44} height={44} className="rounded-xl" priority />
          <div>
            <p className="text-sm font-semibold leading-tight">{BRAND.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-muted">{BRAND.short}</p>
          </div>
        </div>

        <p className="neon-text mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-accent">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure Terminal
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">
          {isRegister ? "Initialize Access" : "Resume Session"}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {isRegister
            ? "Create your identity with an email and a password — that's it."
            : "Enter your email and password to re-enter the grid."}
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          {/* email */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Email Identifier
            </span>
            <div className="glass flex items-center overflow-hidden rounded-xl transition focus-within:neon-border">
              <Mail className="ml-3 h-4 w-4 text-fg-muted" />
              <input
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-fg-muted/50"
              />
            </div>
            {fe?.email && <span className="mt-1 block text-[11px] text-danger">{fe.email}</span>}
          </label>

          {/* password */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Password
            </span>
            <div className="glass flex items-center overflow-hidden rounded-xl transition focus-within:neon-border">
              <Lock className="ml-3 h-4 w-4 text-fg-muted" />
              <input
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPw ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={isRegister ? `At least ${MIN_PASSWORD} characters` : "Your password"}
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-fg-muted/50"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="px-3 py-3 text-fg-muted transition hover:text-accent"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fe?.password && <span className="mt-1 block text-[11px] text-danger">{fe.password}</span>}
          </label>

          {/* register-only: promo + socials (compact, for mobile) + terms */}
          {isRegister && (
            <>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
                  Invite Protocol · optional
                </span>
                <div className="glass flex items-center overflow-hidden rounded-xl transition focus-within:neon-border">
                  <Ticket className="ml-3 h-4 w-4 text-fg-muted" />
                  <input
                    name="promo"
                    value={promo}
                    onChange={(e) => setPromo(e.target.value.toUpperCase())}
                    autoComplete="off"
                    placeholder="WELCOME10"
                    className="flex-1 bg-transparent px-3 py-3 font-mono text-sm uppercase tracking-wide outline-none placeholder:text-fg-muted/50"
                  />
                </div>
                {fe?.promo && <span className="mt-1 block text-[11px] text-danger">{fe.promo}</span>}
              </label>

              {/* compact identity connector — visible where the orbit panel is hidden */}
              <div className="lg:hidden">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
                  Connect Identity · ≥ 1
                </span>
                <SocialConnect socials={socials} onChange={onSocialsChange} variant="compact" />
              </div>
              {fe?.socials && <span className="block text-[11px] text-danger">{fe.socials}</span>}

              <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-muted">
                <input
                  type="checkbox"
                  name="terms"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  I acknowledge the <span className="text-accent">Privacy Protocol</span> and accept the{" "}
                  <span className="text-accent">Terms of Engagement</span>.
                </span>
              </label>
              {fe?.terms && <span className="block text-[11px] text-danger">{fe.terms}</span>}

              {/* hidden mirror of socials for the server action */}
              {SOCIAL_ORDER.map((k) => (
                <input key={k} type="hidden" name={`social_${k}`} value={socials[k] ?? ""} />
              ))}
            </>
          )}

          {state?.error && (
            <div className="shake rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-accent/25 to-accent-2/25 px-6 py-3.5 font-mono text-sm uppercase tracking-[0.2em] text-fg transition neon-border hover:from-accent/40 hover:to-accent-2/40 disabled:opacity-60"
          >
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin-slow" />
            ) : (
              <>
                {isRegister ? "Execute Register" : "Execute Login"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        {/* security note */}
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-fg-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          {t("auth.securityNote")}
        </p>

        {/* footer: switch mode + admin shortcut */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          {isRegister ? (
            <p className="text-fg-muted">
              Already inside?{" "}
              <Link href="/login" className="text-accent underline-offset-4 hover:underline">
                Resume session
              </Link>
            </p>
          ) : (
            <p className="text-fg-muted">
              New here?{" "}
              <Link href="/register" className="text-accent underline-offset-4 hover:underline">
                Initialize identity
              </Link>
            </p>
          )}

          {!isRegister && adminEmail && (
            <button
              type="button"
              onClick={useAdmin}
              className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted transition hover:text-accent"
            >
              <UserCog className="h-3.5 w-3.5" /> Enter as operator
            </button>
          )}
        </div>

        {isRegister && socialCount > 0 && (
          <p className="mt-3 font-mono text-[11px] text-success lg:hidden">
            {socialCount} identity{socialCount > 1 ? " networks" : ""} linked ✓
          </p>
        )}
      </div>
    </div>
  );
}
