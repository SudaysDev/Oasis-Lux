import "server-only";
import { Resend } from "resend";
import { authConfig } from "@/lib/auth/server";

/**
 * Branded OTP email delivery (free — replaces paid SMS).
 *
 * The "from" address comes from OTP_EMAIL_FROM. With Resend's shared
 * `onboarding@resend.dev` sender you can only deliver to your *own* account
 * email; to send to any address, verify a domain in Resend and set e.g.
 * OTP_EMAIL_FROM="OASIS LUX <noreply@your-domain>".
 */

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://oasis-lux.vercel.app").replace(/\/$/, "");
const ICON = `${SITE}/brand-icon.png`;
const ACCENT = "#22d3ee";

type Locale = "en" | "ru" | "tg";

const COPY: Record<Locale, {
  subject: (c: string) => string;
  preview: string;
  heading: string;
  intro: string;
  expires: string;
  warnTitle: string;
  warn: string;
  ignore: string;
  footer: string;
}> = {
  en: {
    subject: (c) => `${c} is your OASIS LUX code`,
    preview: "Your one-time OASIS LUX sign-in code",
    heading: "Verify it’s you",
    intro: "Use this one-time code to continue signing in to OASIS LUX.",
    expires: "This code expires in 5 minutes.",
    warnTitle: "Keep this code private",
    warn: "OASIS LUX will never ask you for this code by phone, chat or message. Never share it with anyone — not even support.",
    ignore: "Didn’t request this? You can safely ignore this email.",
    footer: "OASIS LUX · Distilled Luxury · Realtime Delivery",
  },
  ru: {
    subject: (c) => `${c} — ваш код OASIS LUX`,
    preview: "Ваш одноразовый код входа в OASIS LUX",
    heading: "Подтвердите, что это вы",
    intro: "Используйте этот одноразовый код, чтобы продолжить вход в OASIS LUX.",
    expires: "Код действует 5 минут.",
    warnTitle: "Никому не сообщайте этот код",
    warn: "OASIS LUX никогда не запрашивает этот код по телефону, в чате или сообщениях. Не сообщайте его никому — даже поддержке.",
    ignore: "Не запрашивали код? Просто проигнорируйте это письмо.",
    footer: "OASIS LUX · Роскошь на розлив · Доставка в реальном времени",
  },
  tg: {
    subject: (c) => `${c} — рамзи OASIS LUX-и шумо`,
    preview: "Рамзи яккаратаи воридшавӣ ба OASIS LUX",
    heading: "Тасдиқ кунед, ки ин шумоед",
    intro: "Барои идомаи воридшавӣ ба OASIS LUX ин рамзи яккаратаро истифода баред.",
    expires: "Рамз 5 дақиқа эътибор дорад.",
    warnTitle: "Ин рамзро ба касе нагӯед",
    warn: "OASIS LUX ҳеҷ гоҳ ин рамзро тавассути телефон, чат ё паём намепурсад. Онро ба ҳеҷ кас нагӯед — ҳатто ба дастгирӣ.",
    ignore: "Рамзро дархост накардед? Метавонед ин номаро нодида гиред.",
    footer: "OASIS LUX · Боҳашамат · Расонидан дар вақти воқеӣ",
  },
};

function renderHtml(code: string, t: (typeof COPY)[Locale]): string {
  const cells = code
    .split("")
    .map(
      (d) =>
        `<td style="padding:0 6px;"><div style="width:46px;height:58px;line-height:58px;text-align:center;border-radius:12px;background:#0a0e18;border:1px solid #1e2a3a;color:${ACCENT};font-size:30px;font-weight:800;font-family:'Courier New',monospace;">${d}</div></td>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OASIS LUX</title></head>
<body style="margin:0;background:#05070d;color:#e6f1ff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${t.preview}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0a0e18;border:1px solid #1a2333;border-radius:20px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px;"><img src="${ICON}" width="40" height="40" alt="OASIS LUX" style="display:block;border-radius:10px;"></td>
            <td><div style="font-size:16px;font-weight:700;color:#ffffff;">OASIS LUX</div>
                <div style="font-size:10px;letter-spacing:3px;color:#6b7a90;font-family:'Courier New',monospace;">OASIS</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:18px 32px 0;">
          <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${ACCENT};font-family:'Courier New',monospace;">Secure terminal</div>
          <h1 style="margin:8px 0 6px;font-size:24px;color:#ffffff;">${t.heading}</h1>
          <p style="margin:0;color:#9fb0c6;font-size:14px;line-height:1.6;">${t.intro}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 6px;" align="center">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
        </td></tr>
        <tr><td style="padding:6px 32px 0;" align="center">
          <p style="margin:0;color:#6b7a90;font-size:12px;">${t.expires}</p>
        </td></tr>
        <tr><td style="padding:22px 32px 0;">
          <div style="background:#12080a;border:1px solid #3a1d22;border-radius:12px;padding:14px 16px;">
            <div style="font-size:13px;font-weight:700;color:#ff8a9b;margin-bottom:4px;">⚠ ${t.warnTitle}</div>
            <div style="font-size:13px;color:#c98b95;line-height:1.6;">${t.warn}</div>
          </div>
        </td></tr>
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:0;color:#6b7a90;font-size:12px;line-height:1.6;">${t.ignore}</p>
          <hr style="border:none;border-top:1px solid #1a2333;margin:18px 0;">
          <p style="margin:0;color:#56657b;font-size:11px;font-family:'Courier New',monospace;letter-spacing:1px;">${t.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export type SendOtpResult = { ok: true } | { ok: false; error: string };

/** Send a branded OTP email. Returns ok:false (not throw) so callers degrade gracefully. */
export async function sendOtpEmail(to: string, code: string, locale: Locale = "ru"): Promise<SendOtpResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email delivery is not configured." };
  const t = COPY[locale] ?? COPY.ru;
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: authConfig.otpEmailFrom,
      to,
      subject: t.subject(code),
      html: renderHtml(code, t),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email send failed." };
  }
}
