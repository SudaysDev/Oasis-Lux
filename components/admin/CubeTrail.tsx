"use client";

import { useEffect, useRef } from "react";
import { useIsClient } from "@/hooks/useIsClient";

/**
 * Green "hacker" cubic trail that chases the cursor across the admin panel.
 * Pure canvas, pointer-events:none, runs only while the tab is visible.
 */
type Cube = { x: number; y: number; vx: number; vy: number; size: number; life: number; spin: number; rot: number };

export function CubeTrail() {
  const isClient = useIsClient();
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const cubes: Cube[] = [];
    let lastX = w / 2;
    let lastY = h / 2;
    let raf = 0;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      const moved = Math.hypot(e.movementX, e.movementY);
      const spawn = Math.min(3, 1 + Math.floor(moved / 14));
      for (let i = 0; i < spawn; i++) {
        cubes.push({
          x: lastX + (Math.random() - 0.5) * 8,
          y: lastY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2 - 0.3,
          size: 6 + Math.random() * 12,
          life: 1,
          spin: (Math.random() - 0.5) * 0.16,
          rot: Math.random() * Math.PI,
        });
      }
      if (cubes.length > 220) cubes.splice(0, cubes.length - 220);
    };

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = cubes.length - 1; i >= 0; i--) {
        const c = cubes[i];
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.012;
        c.rot += c.spin;
        c.life -= 0.014;
        if (c.life <= 0) {
          cubes.splice(i, 1);
          continue;
        }
        const a = c.life;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        const s = c.size * (0.6 + c.life * 0.4);
        ctx.shadowColor = "rgba(34,255,136,0.9)";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = `rgba(34,255,136,${a})`;
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = `rgba(34,255,136,${a * 0.1})`;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  if (!isClient) return null;
  // z-50 keeps the trail ABOVE the cards/content (so it's actually visible as a
  // cursor trail) but below modals (z-60). pointer-events-none = purely cosmetic.
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-50 opacity-80" aria-hidden />;
}
