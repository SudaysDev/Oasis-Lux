import "server-only";

/**
 * OASIS LUX :: Operator (admin) accounts.
 *
 * Admins have **no registration** — only login, and only with a single secret
 * "operator key" (the password). The key itself identifies which operator is
 * signing in (no email/username field on the admin tab).
 *
 * Each operator maps to a Supabase auth user with a fixed synthetic email and
 * the operator key as its password. The accounts are provisioned lazily on the
 * first successful admin login (see `ensureAdminAccount` in the auth actions),
 * so there is no separate seed step. The default `username` is set on creation;
 * the operator can rename themselves afterwards without breaking login (login is
 * keyed on the fixed email + key, not the username).
 *
 * To rotate a key later, move these into env vars and read them here.
 */

export type AdminAccount = {
  /** Stable synthetic identity — never receives mail, never shown on the form. */
  email: string;
  /** Default nickname seeded on first login (operator can change it later). */
  username: string;
  /** The secret operator key — this is what gets typed into the admin tab. */
  key: string;
};

export const ADMIN_ACCOUNTS: AdminAccount[] = [
  {
    email: "sudays@operator.oasislux.app",
    username: "Sudays",
    key: "French37Tree9780Earth1028Ball_BrazilSpyder128931",
  },
  {
    email: "waxa@operator.oasislux.app",
    username: "Waxa",
    key: "Argentina89Uranus1240Monro7868Snake_KaiserHome_Lander8544",
  },
];

/**
 * THE OWNER. There are two operators but they are NOT equal: the owner (creator)
 * outranks every other admin — the owner can ban / restrict / delete a fellow
 * admin, but no one can ever touch the owner. Identity is keyed on the stable
 * operator email (usernames can be changed; the email/key can't).
 */
export const OWNER_EMAIL = "sudays@operator.oasislux.app";

export function isOwnerEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

/**
 * Can an operator with `actorEmail` moderate a fellow admin with `targetEmail`?
 * - the owner is untouchable (returns false for any actor);
 * - only the owner may moderate another (non-owner) admin.
 * (Call this ONLY when the target is actually an admin — normal users aren't gated.)
 */
export function canModerateAdmin(actorEmail?: string | null, targetEmail?: string | null): boolean {
  if (isOwnerEmail(targetEmail)) return false;   // the owner can never be sanctioned
  return isOwnerEmail(actorEmail);               // and only the owner outranks a fellow admin
}

/** True when an email belongs to a reserved operator identity (block in register). */
export function isOperatorEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return ADMIN_ACCOUNTS.some((a) => a.email === e) || e.endsWith("@operator.oasislux.app");
}

/** Find the operator whose key matches (length-aware constant-ish compare). */
export function findAdminByKey(key: string): AdminAccount | null {
  let match: AdminAccount | null = null;
  for (const acc of ADMIN_ACCOUNTS) {
    // Compare every account so timing doesn't reveal which one matched.
    if (safeEqual(acc.key, key)) match = acc;
  }
  return match;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
