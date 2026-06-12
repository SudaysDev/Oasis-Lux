import { cn } from "@/lib/utils";

type Props = {
  items: string[];
  duration?: number;
  reverse?: boolean;
  className?: string;
};

/** Seamless infinite ticker (CSS animation; the list is duplicated for the loop). */
export function Marquee({ items, duration = 28, reverse = false, className }: Props) {
  const doubled = [...items, ...items];
  return (
    <div className={cn("mask-fade-x overflow-hidden", className)}>
      <div
        className={cn("flex w-max animate-marquee", reverse && "marquee-reverse")}
        style={{ ["--marquee-duration" as string]: `${duration}s` } as React.CSSProperties}
      >
        {doubled.map((it, i) => (
          <span
            key={`${it}-${i}`}
            className="mx-6 flex items-center gap-6 font-mono text-sm uppercase tracking-[0.3em] text-fg-muted"
          >
            {it}
            <span className="text-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
