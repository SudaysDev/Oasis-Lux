"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bike,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  LoaderCircle,
  ShieldCheck,
  ShieldHalf,
  UserRound,
} from "lucide-react";
import { useT } from "@/hooks/useT";
import { BRAND } from "@/lib/config";
import type { AuthFormState } from "@/lib/auth/shared";

type Kind = "client" | "courier" | "admin";

type Props = {
  /** Email + password login for client & courier tabs. */
  submitAction: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** Operator-key login for the admin tab. */
  adminAction: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

const TABS: { kind: Kind; label: string; Icon: typeof UserRound }[] = [
  { kind: "client", label: "Client", Icon: UserRound },
  { kind: "courier", label: "Courier", Icon: Bike },
  { kind: "admin", label: "Admin", Icon: ShieldHalf },
];

const COPY: Record<Kind, { title: string; sub: string }> = {
  client: { title: "Resume Session", sub: "Enter your email and password to re-enter the grid." },
  courier: { title: "Courier Access", sub: "Sign in to your courier terminal to pick up routes." },
  admin: { title: "Admin Override", sub: "Single secret key. No email. No registration." },
};

export function LoginForms({ submitAction, adminAction }: Props) {
  const { t } = useT();
  const [kind, setKind] = useState<Kind>("client");

  const [userState, userFormAction, userPending] = useActionState<AuthFormState, FormData>(submitAction, undefined);
  const [adminState, adminFormAction, adminPending] = useActionState<AuthFormState, FormData>(adminAction, undefined);

  const isAdmin = kind === "admin";
  const state = isAdmin ? adminState : userState;
  const pending = isAdmin ? adminPending : userPending;
  const formAction = isAdmin ? adminFormAction : userFormAction;
  const fe = state?.fieldErrors;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const copy = COPY[kind];

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

        {/* role selector */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-[var(--panel-border)] bg-bg-elev/50 p-1 backdrop-blur-xl">
          {TABS.map(({ kind: k, label, Icon }) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`relative flex items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 font-mono text-[11px] uppercase tracking-[0.15em] transition ${
                  active ? "text-on-accent" : "text-fg-muted hover:text-fg"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="login-tab"
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent to-accent-2 shadow-[0_0_18px_var(--accent-glow)]"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={kind}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="mt-6 text-3xl font-black uppercase tracking-tight sm:text-4xl">{copy.title}</h1>
            <p className="mt-2 text-sm text-fg-muted">{copy.sub}</p>

            <form action={formAction} className="mt-6 space-y-4">
              {!isAdmin && (
                <>
                  <input type="hidden" name="kind" value={kind} />

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
                </>
              )}

              {/* password / operator key */}
              <label className="block">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-fg-muted">
                  {isAdmin ? "Admin Key" : "Password"}
                </span>
                <div
                  className={`flex items-center overflow-hidden rounded-xl transition focus-within:neon-border ${
                    isAdmin ? "border border-accent/30 bg-bg-elev/60" : "glass"
                  }`}
                >
                  {isAdmin ? (
                    <KeyRound className="ml-3 h-4 w-4 text-accent" />
                  ) : (
                    <Lock className="ml-3 h-4 w-4 text-fg-muted" />
                  )}
                  <input
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPw ? "text" : "password"}
                    autoComplete={isAdmin ? "off" : "current-password"}
                    placeholder={isAdmin ? "Paste your secret key" : "Your password"}
                    className={`flex-1 bg-transparent px-3 py-3 text-sm outline-none placeholder:text-fg-muted/50 ${
                      isAdmin ? "font-mono tracking-tight" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide" : "Show"}
                    className="px-3 py-3 text-fg-muted transition hover:text-accent"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fe?.password && <span className="mt-1 block text-[11px] text-danger">{fe.password}</span>}
              </label>

              {state?.error && (
                <div className="shake rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {state.error}
                </div>
              )}

              <button
                type="submit"
                disabled={pending}
                className={`group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 font-mono text-sm uppercase tracking-[0.2em] text-fg transition neon-border disabled:opacity-60 ${
                  isAdmin
                    ? "bg-gradient-to-r from-accent/40 to-accent-2/30 hover:from-accent/55 hover:to-accent-2/45"
                    : "bg-gradient-to-r from-accent/25 to-accent-2/25 hover:from-accent/40 hover:to-accent-2/40"
                }`}
              >
                {pending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin-slow" />
                ) : (
                  <>
                    {isAdmin ? "Override & Enter" : "Execute Login"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </AnimatePresence>

        {/* security note */}
        <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-fg-muted">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          {isAdmin
            ? "Admin access is logged. Two admin keys exist — guard yours."
            : t("auth.securityNote")}
        </p>

        {/* footer: switch to register (clients only) */}
        {!isAdmin && (
          <div className="mt-5 text-sm">
            <p className="text-fg-muted">
              New here?{" "}
              <Link href="/register" className="text-accent underline-offset-4 hover:underline">
                Initialize identity
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
