import type { ReactNode } from "react";

/** Consistent "module under construction" panel for admin sections still being built. */
export function AdminPlaceholder({
  kicker,
  title,
  blurb,
  children,
}: {
  kicker: string;
  title: string;
  blurb: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em]" style={{ color: "#22ff88" }}>
        {kicker}
      </p>
      <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">{blurb}</p>

      <div
        className="mt-8 overflow-hidden rounded-2xl border p-8"
        style={{ borderColor: "rgba(34,255,136,0.18)", background: "rgba(34,255,136,0.03)" }}
      >
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-fg-muted">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full"
              style={{ background: "#22ff88" }}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#22ff88" }} />
          </span>
          Module initializing
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full w-1/3 animate-pulse rounded-full"
            style={{ background: "linear-gradient(90deg,transparent,#22ff88,transparent)" }}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
