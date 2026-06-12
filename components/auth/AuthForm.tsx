"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import toast from "react-hot-toast";
import { ArrowRight, KeyRound, LoaderCircle, ShieldCheck, Ticket, UserCog } from "lucide-react";
import { SocialConnect } from "./SocialConnect";
import { isValidTjPhone, tjNationalDigits } from "@/lib/utils";
import { BRAND } from "@/lib/config";
import { SOCIAL_ORDER, type AuthFormState, type AuthMode, type OtpResult } from "@/lib/auth/shared";
import type { Socials } from "@/types";

type RequestOtp = (phoneRaw: string, purpose: AuthMode) => Promise<OtpResult>;

type Props = {
  mode: AuthMode;
  /** Lifted `useActionState` from <AuthExperience> so both panels share errors. */
  formAction: (formData: FormData) => void;
  state: AuthFormState;
  pending: boolean;
  requestOtp: RequestOtp;
  socials: Socials;
  onSocialsChange: (next: Socials) => void;
  adminPhone?: string;
};

function groupNational(d: string): string {
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

export function AuthForm({
  mode,
  formAction,
  state,
  pending,
  requestOtp,
  socials,
  onSocialsChange,
  adminPhone,
}: Props) {
  const isRegister = mode === "register";

  const [national, setNational] = useState("");
  const [otp, setOtp] = useState("");
  const [promo, setPromo] = useState("");
  const [terms, setTerms] = useState(false);

  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devHint, setDevHint] = useState<string | null>(null);
  const [otpPending, startOtp] = useTransition();
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const socialCount = Object.keys(socials).length;
  const fe = state?.fieldErrors;

  const sendToken = () => {
    if (!isValidTjPhone(national)) {
      toast.error("Enter a valid +992 number first.");
      return;
    }
    startOtp(async () => {
      const res = await requestOtp(national, mode);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOtpSent(true);
      setCountdown(60);
      if (res.devCode) {
        setOtp(res.devCode); // dev convenience: auto-fill the issued token
        setDevHint(res.devCode);
        toast.success(`Token issued · ${res.devCode}`);
      } else {
        setDevHint(res.masterHint ?? null);
        toast.success("Token sent.");
      }
      otpRef.current?.focus();
    });
  };

  const useAdmin = () => {
    if (!adminPhone) return;
    setNational(tjNationalDigits(adminPhone));
    toast("Operator number loaded — request a token.", { icon: "⌁" });
  };

  return (
    <div className="relative flex w-full items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        {/* brand */}
        <div className="mb-8 flex items-center gap-3">
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
            ? "Phone is your identity. No passwords — verify with a one-time token."
            : "Enter your number and the one-time token to re-enter the grid."}
        </p>

        <form action={formAction} className="mt-7 space-y-5">
          {/* phone */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Mobile Identifier
            </span>
            <div className="glass flex items-center overflow-hidden rounded-xl transition focus-within:neon-border">
              <span className="border-r border-[var(--panel-border)] px-3 py-3 font-mono text-sm text-accent">
                +992
              </span>
              <input
                value={groupNational(national)}
                onChange={(e) => setNational(tjNationalDigits(e.target.value))}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="90 123 45 67"
                className="flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-fg-muted/50"
              />
            </div>
            <input type="hidden" name="phone" value={national} />
            {fe?.phone && <span className="mt-1 block text-[11px] text-danger">{fe.phone}</span>}
          </label>

          {/* otp */}
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
              Offline Code · OTP
            </span>
            <div className="glass flex items-center overflow-hidden rounded-xl transition focus-within:neon-border">
              <KeyRound className="ml-3 h-4 w-4 text-fg-muted" />
              <input
                ref={otpRef}
                name="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                className="flex-1 bg-transparent px-3 py-3 font-mono text-sm tracking-[0.4em] outline-none placeholder:tracking-normal placeholder:text-fg-muted/50"
              />
              <button
                type="button"
                onClick={sendToken}
                disabled={otpPending || countdown > 0}
                className="h-full border-l border-[var(--panel-border)] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent transition hover:bg-accent/10 disabled:opacity-50"
              >
                {otpPending ? "…" : countdown > 0 ? `${countdown}s` : otpSent ? "Resend" : "Send Token"}
              </button>
            </div>
            {devHint && (
              <span className="mt-1 block font-mono text-[11px] text-success">
                dev token ▸ {devHint}
              </span>
            )}
            {fe?.otp && <span className="mt-1 block text-[11px] text-danger">{fe.otp}</span>}
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

        {/* footer: switch mode + admin shortcut */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
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

          {!isRegister && adminPhone && (
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
