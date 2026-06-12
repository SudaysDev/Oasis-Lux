import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types";

/** Telegram-Premium-style plan chip. `free` renders nothing. */
export function PlanBadge({ plan, className }: { plan: Plan; className?: string }) {
  if (plan === "free") return null;
  const elite = plan === "elite";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
        elite ? "badge-rainbow text-white" : "bg-gradient-to-r from-accent to-accent-2 text-black",
        className,
      )}
    >
      {elite ? "Elite" : "Pro"}
    </span>
  );
}

/** Verified tick. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck className={cn("h-4 w-4 text-accent drop-shadow-[0_0_6px_var(--accent-glow)]", className)} aria-label="Verified" />
  );
}
