// ============================================================================
// OASIS LUX :: auto-moderation policy engine.
// Given a violation (category + severity) and how many prior offences the
// subject already has, it picks an escalating punishment — a warning first,
// then a short mute, longer mutes, temp bans, and finally a permanent ban or a
// product deletion. Pure & deterministic so it runs server-side with no API.
// ============================================================================

export type ModSubject = "user" | "product";
export type ViolationCategory = "photo" | "text" | "username" | "harassment" | "scam" | "spam" | "other";
export type ModAction =
  | "warn" | "mute_chat" | "mute_review" | "block_sell" | "ban" | "hide_product" | "delete_product";

export interface ModDecision {
  action: ModAction;
  durationMs: number | null; // ms for timed, null = permanent / not-applicable
  label: string;             // human, e.g. "Chat muted · 3d"
  severityScore: number;     // severity + priors (the escalation level used)
}

const H = 3_600_000, D = 86_400_000;

export function humanDur(ms: number | null): string {
  if (ms === null) return "permanent";
  if (ms >= D) return `${Math.round(ms / D)}d`;
  if (ms >= H) return `${Math.round(ms / H)}h`;
  return `${Math.round(ms / 60_000)}m`;
}

type Step = { action: ModAction; durationMs: number | null };
const warn: Step = { action: "warn", durationMs: null };
const mute = (ms: number): Step => ({ action: "mute_chat", durationMs: ms });
const ban = (ms: number | null): Step => ({ action: "ban", durationMs: ms });
const hide = (ms: number | null): Step => ({ action: "hide_product", durationMs: ms });
const del: Step = { action: "delete_product", durationMs: null };

// Escalation ladders — index = clamp(severity + priorOffences) - 1.
const USER_LADDERS: Record<string, Step[]> = {
  text:       [warn, mute(1 * H), mute(1 * D), mute(3 * D), mute(7 * D), ban(7 * D), ban(30 * D), ban(null)],
  username:   [warn, mute(1 * H), mute(1 * D), mute(3 * D), mute(7 * D), ban(7 * D), ban(30 * D), ban(null)],
  spam:       [warn, mute(1 * H), mute(6 * H), mute(1 * D), mute(7 * D), ban(7 * D)],
  photo:      [warn, mute(1 * D), ban(3 * D), ban(7 * D), ban(30 * D), ban(null)],
  harassment: [mute(1 * D), ban(3 * D), ban(7 * D), ban(30 * D), ban(null)],
  scam:       [ban(7 * D), ban(30 * D), ban(null)],
  other:      [warn, mute(1 * H), mute(1 * D), ban(7 * D), ban(30 * D)],
};
const PRODUCT_LADDERS: Record<string, Step[]> = {
  photo: [hide(3 * D), hide(7 * D), hide(null), del, del],
  text:  [hide(3 * D), hide(7 * D), hide(null), del],
  spam:  [hide(1 * D), hide(7 * D), del],
  scam:  [del],
  other: [hide(3 * D), hide(null), del],
};

function labelFor(s: Step): string {
  switch (s.action) {
    case "warn": return "Warning issued";
    case "mute_chat": return `Chat muted · ${humanDur(s.durationMs)}`;
    case "mute_review": return `Reviews muted · ${humanDur(s.durationMs)}`;
    case "block_sell": return `Selling blocked · ${humanDur(s.durationMs)}`;
    case "ban": return s.durationMs === null ? "Banned · permanent" : `Banned · ${humanDur(s.durationMs)}`;
    case "hide_product": return s.durationMs === null ? "Product hidden · permanent" : `Product hidden · ${humanDur(s.durationMs)}`;
    case "delete_product": return "Product deleted";
  }
}

export function decidePunishment(p: {
  subject: ModSubject; category: ViolationCategory; severity: number; priorCount: number;
}): ModDecision {
  const score = Math.max(1, Math.min(99, Math.round(p.severity) + Math.max(0, p.priorCount)));
  const ladders = p.subject === "user" ? USER_LADDERS : PRODUCT_LADDERS;
  const ladder = ladders[p.category] ?? ladders.other;
  const step = ladder[Math.min(score - 1, ladder.length - 1)];
  return { action: step.action, durationMs: step.durationMs, label: labelFor(step), severityScore: score };
}

// UI metadata ---------------------------------------------------------------
export const USER_CATEGORIES: { id: ViolationCategory; label: string; severity: number }[] = [
  { id: "text", label: "Inappropriate words (chat / bio)", severity: 2 },
  { id: "username", label: "Inappropriate username", severity: 2 },
  { id: "photo", label: "Inappropriate photo (avatar / banner)", severity: 3 },
  { id: "harassment", label: "Harassment / abuse", severity: 3 },
  { id: "scam", label: "Scam / fraud", severity: 5 },
  { id: "spam", label: "Spam", severity: 1 },
  { id: "other", label: "Other", severity: 2 },
];
export const PRODUCT_CATEGORIES: { id: ViolationCategory; label: string; severity: number }[] = [
  { id: "photo", label: "Inappropriate photo", severity: 3 },
  { id: "text", label: "Inappropriate description / title", severity: 2 },
  { id: "scam", label: "Counterfeit / scam", severity: 5 },
  { id: "spam", label: "Spam / mis-listed", severity: 1 },
  { id: "other", label: "Other", severity: 2 },
];
