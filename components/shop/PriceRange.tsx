"use client";

import { useEffect, useRef } from "react";

/** Clean custom dual-handle price slider (pointer-drag, no native range quirks). */
export function PriceRange({
  min,
  max,
  step = 50,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<null | "lo" | "hi">(null);
  const pct = (v: number) => ((v - min) / (max - min)) * 100;

  useEffect(() => {
    const valueAt = (clientX: number) => {
      const r = trackRef.current?.getBoundingClientRect();
      if (!r) return min;
      const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      return Math.round((min + p * (max - min)) / step) * step;
    };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const v = valueAt(e.clientX);
      if (dragging.current === "lo") onChange([Math.min(v, hi - step), hi]);
      else onChange([lo, Math.max(v, lo + step)]);
    };
    const up = () => { dragging.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [lo, hi, min, max, step, onChange]);

  const handle = (which: "lo" | "hi", v: number) => (
    <button
      type="button"
      aria-label={which === "lo" ? "Minimum price" : "Maximum price"}
      onPointerDown={(e) => { e.preventDefault(); dragging.current = which; }}
      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-bg-elev bg-accent shadow-[0_0_10px_var(--accent-glow)] transition-transform hover:scale-125 active:cursor-grabbing"
      style={{ left: `${pct(v)}%` }}
    />
  );

  return (
    <div className="select-none px-1.5 py-2.5">
      <div ref={trackRef} className="relative h-1.5 w-full rounded-full bg-[var(--panel-border)]">
        <div className="absolute h-full rounded-full bg-accent" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        {handle("lo", lo)}
        {handle("hi", hi)}
      </div>
    </div>
  );
}
