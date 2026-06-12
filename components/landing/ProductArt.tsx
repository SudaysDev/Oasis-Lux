import type { ProductType } from "@/types";

// Round to 2 dp so trig-derived SVG coords are identical on server & client
// (avoids float ULP hydration mismatches like 78.43078...694 vs ...696).
const r2 = (n: number) => Math.round(n * 100) / 100;

// Procedural, generated product visuals (no stock photos exist yet — drop real
// images into /public/products later and swap these for <Image>). Each is a neon
// glass SVG; `hue` rotates the palette so a grid of cards looks varied.

type Props = { type: ProductType; uid: string; hue?: number; className?: string };

export function ProductArt({ type, uid, hue = 0, className }: Props) {
  return (
    <div
      className={className}
      style={{ filter: `hue-rotate(${hue}deg) drop-shadow(0 12px 30px rgba(34,211,238,0.25))` }}
      aria-hidden="true"
    >
      {type === "perfume" ? (
        <PerfumeArt uid={uid} />
      ) : type === "watch" ? (
        <WatchArt uid={uid} />
      ) : (
        <GlassesArt uid={uid} />
      )}
    </div>
  );
}

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7ff3ff" />
        <stop offset="45%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#a855f7" />
      </linearGradient>
      <linearGradient id={`${uid}-liquid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
      </linearGradient>
      <radialGradient id={`${uid}-halo`} cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function PerfumeArt({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full">
      <Defs uid={uid} />
      <ellipse cx="100" cy="130" rx="92" ry="100" fill={`url(#${uid}-halo)`} />
      <rect x="74" y="18" width="52" height="30" rx="8" fill={`url(#${uid}-glass)`} opacity="0.9" />
      <rect x="86" y="44" width="28" height="20" fill="#0a0e18" stroke={`url(#${uid}-glass)`} strokeWidth="1.5" />
      <path d="M70 70 Q100 52 130 70 L142 92 142 196 Q142 214 124 214 L76 214 Q58 214 58 196 L58 92 Z"
        fill="#0a0e18" stroke={`url(#${uid}-glass)`} strokeWidth="2" />
      <path d="M64 150 L136 150 136 196 Q136 208 124 208 L76 208 Q64 208 64 196 Z" fill={`url(#${uid}-liquid)`} />
      <rect x="74" y="120" width="52" height="44" rx="6" fill="#05070d" opacity="0.55" />
      <rect x="80" y="128" width="40" height="3" rx="1.5" fill={`url(#${uid}-glass)`} />
      <rect x="80" y="138" width="28" height="2.5" rx="1.25" fill="#22d3ee" opacity="0.6" />
      <path d="M78 84 Q86 78 92 90 L92 150 84 150 Z" fill="#ffffff" opacity="0.12" />
    </svg>
  );
}

function WatchArt({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full">
      <Defs uid={uid} />
      <ellipse cx="100" cy="120" rx="96" ry="96" fill={`url(#${uid}-halo)`} />
      <rect x="78" y="6" width="44" height="74" rx="14" fill="#0a0e18" stroke={`url(#${uid}-glass)`} strokeWidth="1.5" />
      <rect x="78" y="160" width="44" height="74" rx="14" fill="#0a0e18" stroke={`url(#${uid}-glass)`} strokeWidth="1.5" />
      <circle cx="100" cy="120" r="62" fill="#05070d" stroke={`url(#${uid}-glass)`} strokeWidth="3" />
      <circle cx="100" cy="120" r="50" fill="#0a0e18" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = 48;
        const rInner = i % 3 === 0 ? 38 : 43;
        return (
          <line
            key={i}
            x1={r2(100 + Math.cos(a) * r1)}
            y1={r2(120 + Math.sin(a) * r1)}
            x2={r2(100 + Math.cos(a) * rInner)}
            y2={r2(120 + Math.sin(a) * rInner)}
            stroke={`url(#${uid}-glass)`}
            strokeWidth={i % 3 === 0 ? 3 : 1.5}
            strokeLinecap="round"
          />
        );
      })}
      <line x1="100" y1="120" x2="100" y2="88" stroke="#e6f1ff" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="100" y1="120" x2="126" y2="132" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="120" r="4" fill="#a855f7" />
      <rect x="160" y="112" width="10" height="16" rx="3" fill={`url(#${uid}-glass)`} />
    </svg>
  );
}

function GlassesArt({ uid }: { uid: string }) {
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full">
      <Defs uid={uid} />
      <ellipse cx="100" cy="120" rx="96" ry="70" fill={`url(#${uid}-halo)`} />
      <path d="M16 104 Q22 96 40 96 L78 96 Q86 96 88 104" fill="none" stroke={`url(#${uid}-glass)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M112 104 Q114 96 122 96 L160 96 Q178 96 184 104" fill="none" stroke={`url(#${uid}-glass)`} strokeWidth="3" strokeLinecap="round" />
      <rect x="20" y="104" width="74" height="52" rx="22" fill="#05070d" stroke={`url(#${uid}-glass)`} strokeWidth="3" />
      <rect x="106" y="104" width="74" height="52" rx="22" fill="#05070d" stroke={`url(#${uid}-glass)`} strokeWidth="3" />
      <rect x="26" y="110" width="62" height="40" rx="18" fill={`url(#${uid}-glass)`} opacity="0.18" />
      <rect x="112" y="110" width="62" height="40" rx="18" fill={`url(#${uid}-glass)`} opacity="0.18" />
      <path d="M94 116 Q100 110 106 116" fill="none" stroke={`url(#${uid}-glass)`} strokeWidth="3" strokeLinecap="round" />
      <line x1="14" y1="106" x2="2" y2="150" stroke={`url(#${uid}-glass)`} strokeWidth="3" strokeLinecap="round" />
      <line x1="186" y1="106" x2="198" y2="150" stroke={`url(#${uid}-glass)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M30 126 Q44 116 58 122" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
