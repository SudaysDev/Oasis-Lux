"use client";

import { useActionState, useState } from "react";
import { ParticleField } from "@/components/fx/ParticleField";
import { SocialOrbits } from "./SocialOrbits";
import { AuthForm } from "./AuthForm";
import { ThemeToggle } from "./ThemeToggle";
import type { AuthFormState, AuthMode, OtpResult } from "@/lib/auth/shared";
import type { Locale, Socials } from "@/types";

type Props = {
  mode: AuthMode;
  submitAction: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  requestOtp: (email: string, purpose: AuthMode, locale?: Locale) => Promise<OtpResult>;
  adminEmail?: string;
};

export function AuthExperience({ mode, submitAction, requestOtp, adminEmail }: Props) {
  const [socials, setSocials] = useState<Socials>({});
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(submitAction, undefined);

  // Login fits one viewport (no scroll); register can be taller, so it scrolls.
  const isLogin = mode === "login";

  return (
    <main
      className={
        isLogin
          ? "relative h-dvh overflow-hidden bg-bg text-fg"
          : "relative min-h-dvh overflow-x-hidden bg-bg text-fg"
      }
    >
      {/* interactive particle field across the page — stars cling to the cursor (the "fishka") */}
      <ParticleField className="pointer-events-none absolute inset-0 z-0" />
      <div className="animated-grid pointer-events-none absolute inset-0 z-0 opacity-[0.12]" />

      <ThemeToggle className="absolute right-5 top-5 z-30" />

      <div className={`relative z-10 grid lg:grid-cols-2 ${isLogin ? "h-full" : "min-h-dvh"}`}>
        <SocialOrbits
          socials={socials}
          onChange={setSocials}
          mode={mode}
          error={state?.fieldErrors?.socials}
        />

        <div className="auth-terminal relative flex items-center justify-center overflow-hidden border-t border-[var(--panel-border)] lg:border-l lg:border-t-0">
          <div className="scanline" />
          <AuthForm
            mode={mode}
            formAction={formAction}
            state={state}
            pending={pending}
            requestOtp={requestOtp}
            socials={socials}
            onSocialsChange={setSocials}
            adminEmail={adminEmail}
          />
        </div>
      </div>
    </main>
  );
}
