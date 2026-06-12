"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
};

/** Real star rating. Display mode rounds to the nearest star; interactive lets you pick 1–5. */
export function StarRating({ value, size = 16, interactive = false, onChange, className }: Props) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className={cn("flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(shown);
        const star = (
          <Star
            style={{ width: size, height: size }}
            className={cn("transition", filled ? "fill-accent text-accent" : "text-fg-muted/40")}
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange?.(n)}
            className="transition hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
