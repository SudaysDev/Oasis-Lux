"use client";

import { useActionState, useState } from "react";
import { ParticleField } from "@/components/fx/ParticleField";
import { SocialOrbits } from "./SocialOrbits";
import { AuthForm } from "./AuthForm";
import { ThemeToggle } from "./ThemeToggle";
import type { AuthFormState, AuthMode, OtpResult } from "@/lib/auth/shared";
import type { Socials } from "@/types";

type Props = {
  mode: AuthMode;
  submitAction: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  requestOtp: (phoneRaw: string, purpose: AuthMode) => Promise<OtpResult>;
  adminPhone?: string;
};

export function AuthExperience({ mode, submitAction, requestOtp, adminPhone }: Props) {
  const [socials, setSocials] = useState<Socials>({});
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(submitAction, undefined);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg text-fg">
      {/* interactive particle field across the page — stars cling to the cursor (the "fishka") */}
      <ParticleField className="pointer-events-none absolute inset-0 z-0" />
      <div className="animated-grid pointer-events-none absolute inset-0 z-0 opacity-[0.12]" />

      <ThemeToggle className="absolute right-5 top-5 z-30" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <SocialOrbits
          socials={socials}
          onChange={setSocials}
          mode={mode}
          error={state?.fieldErrors?.socials}
        />

        <div className="auth-terminal relative flex items-stretch justify-center overflow-hidden border-t border-[var(--panel-border)] lg:border-l lg:border-t-0">
          <div className="scanline" />
          <AuthForm
            mode={mode}
            formAction={formAction}
            state={state}
            pending={pending}
            requestOtp={requestOtp}
            socials={socials}
            onSocialsChange={setSocials}
            adminPhone={adminPhone}
          />
        </div>
      </div>
    </main>
  );
}
