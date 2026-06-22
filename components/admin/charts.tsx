"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView } from "framer-motion";
import type { Point, Bar } from "@/lib/data/admin-stats";

export const GREEN = "#22ff88";
const PAL = ["#22ff88", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#34d399", "#f472b6", "#60a5fa", "#facc15", "#2dd4bf"];

export function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/* ------------------------------------------------------------------ CountUp */
export function CountUp({
  value,
  format = group,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const inView = useInView(wrap, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [inView, value, format]);

  return (
    <span ref={wrap} className={className}>
      <span ref={ref}>{format(0)}</span>
    </span>
  );
}

/* -------------------------------------------------------------- LiveStatus */
export function LiveStatus() {
  const [clock, setClock] = useState("--:--:--");
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", { hour12: false, timeZone: "Asia/Dushanbe" }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="flex items-center gap-2.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em]"
      style={{ borderColor: "rgba(34,255,136,0.35)", color: GREEN, background: "rgba(34,255,136,0.05)" }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: GREEN }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: GREEN }} />
      </span>
      System online
      <span className="flex items-end gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="w-[2px] rounded-full"
            style={{ background: GREEN }}
            animate={{ height: [4, 11, 6, 13, 4] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}
      </span>
      <span className="tabular-nums text-white/80">{clock}</span>
    </span>
  );
}

/* --------------------------------------------------------------- AreaChart */
export function AreaChart({
  data,
  color = GREEN,
  height = 200,
  unit = "",
}: {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
}) {
  const W = 600;
  const H = 200;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? W / (data.length - 1) : W;
  const xy = data.map((d, i) => {
    const x = Math.round(i * stepX * 100) / 100;
    const y = Math.round((H - (d.value / max) * (H - 24) - 8) * 100) / 100;
    return [x, y] as const;
  });
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const id = `area-${color.replace("#", "")}`;

  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = box.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setActive(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
  };

  return (
    <div
      ref={box}
      className="relative w-full"
      style={{ height }}
      onPointerMove={onMove}
      onPointerLeave={() => setActive(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
        ))}
        <motion.polygon
          points={area}
          fill={`url(#${id})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {active !== null && (
          <>
            <line
              x1={xy[active][0]}
              x2={xy[active][0]}
              y1={0}
              y2={H}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
            <circle cx={xy[active][0]} cy={xy[active][1]} r={5} fill={color} stroke="#04060a" strokeWidth={2} />
          </>
        )}
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border bg-[#04060a]/95 px-2.5 py-1.5 text-center shadow-lg"
          style={{
            left: `${(active / (data.length - 1)) * 100}%`,
            top: 4,
            borderColor: `${color}55`,
          }}
        >
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/50">{data[active].label}</p>
          <p className="text-sm font-bold" style={{ color }}>
            {group(data[active].value)}
            {unit}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- MiniBars */
export function MiniBars({ data, color = GREEN, height = 130 }: { data: Point[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [active, setActive] = useState<number | null>(null);
  return (
    <div className="flex w-full items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        const on = active === i;
        return (
          <div
            key={i}
            className="relative flex flex-1 cursor-pointer items-end"
            style={{ height: "100%" }}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          >
            <motion.div
              className="w-full rounded-t"
              style={{
                background: on ? color : `${color}99`,
                boxShadow: on ? `0 0 14px ${color}` : "none",
              }}
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(2, h)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.025, ease: "easeOut" }}
            />
            {on && (
              <div
                className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-[#04060a]/95 px-2 py-1 text-center"
                style={{ borderColor: `${color}55` }}
              >
                <p className="font-mono text-[8px] uppercase text-white/50">{d.label}</p>
                <p className="text-xs font-bold" style={{ color }}>
                  {group(d.value)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- Donut */
export function Donut({ data, size = 170 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0));
  const r = 58;
  const c = 2 * Math.PI * r;
  const segs = data.map((d, i) => {
    const prev = data.slice(0, i).reduce((s, x) => s + x.value, 0);
    const frac = d.value / total;
    return { ...d, dash: frac * c, gap: c - frac * c, rot: (prev / total) * 360 };
  });
  return (
    <div className="flex items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
          {segs.map((s, i) => (
            <motion.circle
              key={i}
              cx="80"
              cy="80"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={16}
              strokeLinecap="round"
              strokeDasharray={`${s.dash} ${s.gap}`}
              transform={`rotate(${s.rot} 80 80)`}
              initial={{ strokeDashoffset: s.dash }}
              whileInView={{ strokeDashoffset: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: i * 0.12, ease: "easeOut" }}
              style={{ filter: `drop-shadow(0 0 4px ${s.color}88)` }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <CountUp value={total} className="text-2xl font-black text-white" />
          <p className="font-mono text-[9px] uppercase tracking-widest text-white/40">total</p>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}` }} />
            <span className="text-white/70">{d.label}</span>
            <span className="ml-auto font-mono font-semibold text-white">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- RadialGauge */
export function RadialGauge({ value, label, color = GREEN, needle = false }: { value: number; label: string; color?: string; needle?: boolean }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270°
  const filled = (value / 100) * arc * c;
  // needle endpoint in the svg's local frame (svg is rotate-[135deg], arc starts at 3 o'clock)
  const nθ = ((value / 100) * 270 * Math.PI) / 180;
  const nLen = 40;
  const nx = 75 + nLen * Math.cos(nθ);
  const ny = 75 + nLen * Math.sin(nθ);
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[150px] w-[150px]">
        <svg viewBox="0 0 150 150" className="h-full w-full rotate-[135deg]">
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={`${arc * c} ${c}`}
          />
          <motion.circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={11}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
            initial={{ strokeDashoffset: filled }}
            whileInView={{ strokeDashoffset: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
          {needle && (
            // live "speedometer" — needle settles to the value, then breathes ±2.5°
            <motion.g
              style={{ transformOrigin: "75px 75px" }}
              animate={{ rotate: [-2.5, 2.5, -2.5] }}
              transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity }}
            >
              <motion.line
                x1="75" y1="75" x2={nx} y2={ny}
                stroke={color} strokeWidth={3} strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                whileInView={{ pathLength: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                style={{ filter: `drop-shadow(0 0 4px ${color})` }}
              />
              <circle cx="75" cy="75" r={4.5} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
              <motion.circle
                cx={nx} cy={ny} r={3.5} fill={color}
                animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
                style={{ transformOrigin: `${nx}px ${ny}px`, filter: `drop-shadow(0 0 6px ${color})` }}
              />
            </motion.g>
          )}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <CountUp value={value} className="text-3xl font-black" />
          <span className="text-lg font-black" style={{ color }}>
            %
          </span>
        </div>
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/50">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------- StatusBars */
const STATUS_COLOR: Record<string, string> = {
  placed: "#22ff88",
  processing: "#38bdf8",
  out_for_delivery: "#a78bfa",
  arrived: "#fbbf24",
  fulfilled: "#22c55e",
  cancelled: "#ef4444",
};
export function StatusBars({ data }: { data: { status: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-3">
      {data.length === 0 && <p className="text-sm text-white/40">No orders recorded yet.</p>}
      {data.map((d, i) => {
        const color = STATUS_COLOR[d.status] ?? "#888";
        return (
          <div key={d.status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium capitalize text-white/80">{d.status.replace(/_/g, " ")}</span>
              <span className="font-mono" style={{ color }}>
                {d.count}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}88` }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(d.count / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.08, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- ConsoleFeed */
const TONE: Record<string, string> = { green: "#22ff88", cyan: "#38bdf8", amber: "#fbbf24", red: "#ef4444" };
export function ConsoleFeed({ lines }: { lines: { id: string; kind: string; text: string; tone: string }[] }) {
  const [uptime, setUptime] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(Math.floor(uptime / 3600)).padStart(2, "0");
  const mm = String(Math.floor((uptime % 3600) / 60)).padStart(2, "0");
  const ss = String(uptime % 60).padStart(2, "0");

  return (
    <div className="font-mono text-xs">
      <div className="mb-2 flex items-center gap-2 text-white/40">
        <span className="h-2 w-2 rounded-full bg-red-500" />
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
        <span className="ml-2">admin@oasis — session {hh}:{mm}:{ss}</span>
      </div>
      <div className="no-scrollbar max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
        {lines.length === 0 && <p className="text-white/40">$ awaiting grid activity…</p>}
        {lines.map((l, i) => (
          <motion.div
            key={l.id}
            className="flex items-start gap-2"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i * 0.05, 0.8) }}
          >
            <span style={{ color: TONE[l.tone] ?? GREEN }}>$</span>
            <span
              className="rounded px-1 text-[9px] uppercase tracking-wider"
              style={{ background: `${TONE[l.tone] ?? GREEN}22`, color: TONE[l.tone] ?? GREEN }}
            >
              {l.kind}
            </span>
            <span className="text-white/75">{l.text}</span>
          </motion.div>
        ))}
        <span className="inline-block h-3.5 w-2 animate-pulse" style={{ background: GREEN }} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- LivePulse */
/** A live, continuously scrolling EKG-style waveform — the KPI "heartbeat". */
export function LivePulse({ data, color = GREEN, height = 38 }: { data: number[]; color?: string; height?: number }) {
  const W = 120;
  const H = height;
  const n = Math.max(2, data.length);
  const max = Math.max(1, ...data);
  const step = W / (n - 1);
  const pts = data.map((v, i) => [Math.round(i * step * 100) / 100, Math.round((H - (v / max) * (H - 9) - 4) * 100) / 100] as const);
  const p1 = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const p2 = pts.map(([x, y]) => `${(x + W).toFixed(2)},${y}`).join(" ");
  return (
    <div className="relative overflow-hidden" style={{ width: W, height: H }}>
      <svg width={W * 2} height={H} viewBox={`0 0 ${W * 2} ${H}`} className="overflow-visible">
        <motion.g animate={{ x: [0, -W] }} transition={{ duration: Math.max(3, n * 0.22), ease: "linear", repeat: Infinity }}>
          <polyline points={p1} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
          <polyline points={p2} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        </motion.g>
      </svg>
      <motion.span
        className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        animate={{ scale: [1, 1.7, 1], opacity: [1, 0.4, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- HBars */
/** Horizontal labeled bars (regions / brands / categories / plans …). */
export function HBars({ data, suffix = "", max: maxIn }: { data: Bar[]; suffix?: string; max?: number }) {
  const max = Math.max(1, maxIn ?? Math.max(...data.map((d) => d.value)));
  return (
    <div className="space-y-2.5">
      {data.length === 0 && <p className="text-sm text-white/40">No data yet.</p>}
      {data.map((d, i) => {
        const color = d.color ?? PAL[i % PAL.length];
        return (
          <div key={d.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate text-white/80">{d.label}</span>
              <span className="ml-2 shrink-0 font-mono font-semibold" style={{ color }}>
                {group(d.value)}
                {suffix}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}88` }}
                initial={{ width: 0 }}
                whileInView={{ width: `${(d.value / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, delay: i * 0.05, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Funnel */
export function Funnel({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const conv = i > 0 && data[i - 1].value > 0 ? Math.round((d.value / data[i - 1].value) * 100) : null;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-right text-[11px] capitalize text-white/65">{d.label}</span>
            <div className="relative h-9 flex-1">
              <motion.div
                className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-md"
                style={{ background: `${d.color}22`, border: `1px solid ${d.color}66`, boxShadow: `0 0 12px ${d.color}33` }}
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.max(10, pct)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
              >
                <span className="font-mono text-sm font-bold" style={{ color: d.color }}>
                  {group(d.value)}
                </span>
              </motion.div>
            </div>
            <span className="w-10 shrink-0 font-mono text-[10px] text-white/45">{conv !== null ? `${conv}%` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------- Heat */
/** Intensity strip (hours of day / weekdays) with hover values. */
export function Heat({ data, labels, color = GREEN }: { data: number[]; labels?: string[]; color?: string }) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex gap-1">
      {data.map((v, i) => {
        const op = 0.1 + (v / max) * 0.9;
        return (
          <motion.div
            key={i}
            className="group relative flex-1 rounded-[3px]"
            style={{ aspectRatio: "1 / 1.6", background: color }}
            initial={{ opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: op, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.012, duration: 0.4 }}
          >
            <span
              className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded border bg-black/95 px-1.5 py-1 text-center text-[9px] group-hover:block"
              style={{ borderColor: `${color}55`, color }}
            >
              <span className="block text-white/50">{labels ? labels[i] : i}</span>
              {group(v)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
