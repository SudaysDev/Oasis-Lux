// Subscription plans — single source of truth for /billing, the landing page
// pricing section, and the Pro/Elite feature gates (AI assistant, AI covers…).
import type { Plan } from "@/types";

export interface PlanDef {
  key: Plan;
  name: string;
  priceMonthly: number; // TJS (сомонӣ) / month
  tagline: string;
  features: string[];
  highlight?: boolean; // visually featured (the "best value" plan)
  accent: string; // gradient tint
}

export const PLANS: PlanDef[] = [
  {
    key: "free",
    name: "Free",
    priceMonthly: 0,
    tagline: "Browse, buy and sell the essentials.",
    accent: "#8aa0b8",
    features: [
      "Browse the full catalog",
      "Buy with cards, promo codes & cashback",
      "List up to 3 items for sale",
      "Live order tracking on the TJ map",
      "Oasis Helper assistant (basic)",
    ],
  },
  {
    key: "pro",
    name: "Pro Studio",
    priceMonthly: 99,
    tagline: "For serious sellers and power buyers.",
    accent: "#22d3ee",
    highlight: true,
    features: [
      "Everything in Free",
      "Full Gemini AI Assistant (chat, photos, search)",
      "AI auto title, description & brand detection",
      "3 AI-generated cover designs / week",
      "Unlimited listings + featured placement",
      "Advanced sales & purchase analytics",
    ],
  },
  {
    key: "elite",
    name: "Elite",
    priceMonthly: 249,
    tagline: "The complete OASIS LUX power suite.",
    accent: "#a855f7",
    features: [
      "Everything in Pro",
      "Unlimited AI covers & generations",
      "Priority courier dispatch & support",
      "Verified Elite badge on your profile",
      "Lowest commission on every sale",
      "Early access to exclusive drops",
    ],
  },
];

export const PLAN_BY_KEY: Record<Plan, PlanDef> = Object.fromEntries(
  PLANS.map((p) => [p.key, p]),
) as Record<Plan, PlanDef>;

/** Rank for comparing tiers (free < pro < elite). */
export const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, elite: 2 };

/** Does `plan` unlock Pro-tier (or higher) features? */
export const isPaidPlan = (plan: Plan) => PLAN_RANK[plan] >= PLAN_RANK.pro;
