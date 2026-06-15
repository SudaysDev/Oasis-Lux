"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Box, Maximize2, RotateCcw } from "lucide-react";
import { ProductArt } from "@/components/landing/ProductArt";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/useT";
import type { ProductType } from "@/types";

type Slide = { kind: "img"; src: string } | { kind: "art"; hue: number };

function buildSlides(images: string[], hue: number): Slide[] {
  if (images.length) return images.map((src) => ({ kind: "img" as const, src }));
  // No real photos → fabricate distinct "angles" by rotating the neon art hue.
  return [hue, hue + 28, hue + 180, hue + 312].map((h) => ({ kind: "art" as const, hue: ((h % 360) + 360) % 360 }));
}

function DiscountFlag({ pct, off }: { pct: number; off: string }) {
  const tier =
    pct >= 70
      ? "badge-rainbow text-white shadow-[0_0_22px_rgba(168,85,247,0.6)]"
      : pct >= 40
        ? "bg-gradient-to-r from-accent to-accent-2 text-black"
        : "bg-accent/20 text-accent";
  return (
    <span className={cn("absolute left-4 top-4 z-20 rounded-full px-3 py-1.5 font-mono text-xs font-bold", tier)}>
      −{pct}% {off}
    </span>
  );
}

export function ProductGallery({
  type,
  hue,
  title,
  images,
  discount,
}: {
  type: ProductType;
  hue: number;
  title: string;
  images: string[];
  discount?: number;
}) {
  const { t } = useT();
  const slides = buildSlides(images, hue);
  const [active, setActive] = useState(0);
  const [is3D, setIs3D] = useState(false);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const [dragActive, setDragActive] = useState(false);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const slide = slides[active] ?? slides[0];

  const onDown = (e: React.PointerEvent) => {
    if (!is3D) return;
    dragging.current = { x: e.clientX, y: e.clientY };
    setDragActive(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!is3D || !dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    dragging.current = { x: e.clientX, y: e.clientY };
    setRot((r) => ({ x: Math.max(-32, Math.min(32, r.x - dy * 0.4)), y: r.y + dx * 0.5 }));
  };
  const onUp = () => {
    dragging.current = null;
    setDragActive(false);
  };

  const renderMedia = (s: Slide, className?: string) =>
    s.kind === "img" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={s.src} alt={title} className={cn("h-full w-full object-cover", className)} />
    ) : (
      <ProductArt type={type} uid={`gal-${s.hue}`} hue={s.hue} className={cn("h-full w-full p-8", className)} />
    );

  return (
    <div className="lg:sticky lg:top-24">
      {/* main stage */}
      <div
        className="card relative aspect-square w-full overflow-hidden rounded-3xl"
        style={{ perspective: 1200 }}
      >
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(60% 50% at 50% 38%, hsl(${hue} 90% 55% / 0.18), transparent 70%)` }}
        />
        <div className="grid-mesh pointer-events-none absolute inset-0 opacity-[0.18]" />

        {discount ? <DiscountFlag pct={discount} off={t("prod.off")} /> : null}

        <motion.div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          className={cn("relative h-full w-full", is3D && "cursor-grab active:cursor-grabbing")}
          style={{ transformStyle: "preserve-3d" }}
          animate={is3D ? { rotateX: rot.x, rotateY: rot.y } : { rotateX: 0, rotateY: 0 }}
          transition={dragActive ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 14 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
              {renderMedia(slide)}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* 3D toggle */}
        <button
          type="button"
          onClick={() => {
            setIs3D((v) => !v);
            setRot({ x: 0, y: 0 });
          }}
          className={cn(
            "absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full px-3.5 py-2 font-mono text-[11px] uppercase tracking-wider backdrop-blur-md transition",
            is3D ? "neon-border text-accent" : "glass text-fg-muted hover:text-fg",
          )}
        >
          <Box className="h-3.5 w-3.5" /> {is3D ? t("prod.3dOn") : t("prod.3dView")}
        </button>

        {is3D && (
          <button
            type="button"
            onClick={() => setRot({ x: 0, y: 0 })}
            aria-label={t("prod.resetRotation")}
            className="glass absolute bottom-4 left-4 z-20 grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:text-accent"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}

        {!is3D && (
          <span className="glass pointer-events-none absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full text-fg-muted">
            <Maximize2 className="h-4 w-4" />
          </span>
        )}
      </div>

      {is3D && (
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">
          {t("prod.dragRotate")}
        </p>
      )}

      {/* thumbnails */}
      <div className="mt-4 flex gap-3">
        {slides.map((s, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setActive(i)}
            aria-label={`View ${i + 1}`}
            className={cn(
              "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl transition sm:h-20 sm:w-20",
              i === active ? "neon-border" : "card opacity-70 hover:opacity-100",
            )}
          >
            {renderMedia(s, s.kind === "art" ? "p-2.5" : undefined)}
            {i === active && (
              <motion.span
                layoutId="gallery-active"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent-glow)]"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
