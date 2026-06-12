import { cn } from "@/lib/utils";

type Props = { eyebrow?: string; title: string; subtitle?: string; center?: boolean };

export function SectionHeader({ eyebrow, title, subtitle, center }: Props) {
  return (
    <div className={cn(center ? "mx-auto max-w-2xl text-center" : "max-w-2xl")}>
      {eyebrow && (
        <p className="neon-text font-mono text-[11px] uppercase tracking-[0.3em] text-accent">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-4xl xl:text-5xl">{title}</h2>
      {subtitle && <p className="mt-3 text-sm text-fg-muted sm:text-base">{subtitle}</p>}
    </div>
  );
}
