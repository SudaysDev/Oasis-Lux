"use client";

import { motion } from "framer-motion";

const GREEN = "#22ff88";

/**
 * Ambient life for the admin chrome: thin green light beams that occasionally
 * "whoosh" across the top of the layout, plus a slow breathing top-glow.
 */
const BEAMS = [
  { top: 4, width: "38%", dur: 0.95, delay: 1.2, gap: 6.5, opacity: 0.95, h: 1.5 },
  { top: 30, width: "26%", dur: 1.25, delay: 4.0, gap: 9.5, opacity: 0.55, h: 1 },
  { top: 62, width: "32%", dur: 0.8, delay: 7.0, gap: 8.0, opacity: 0.75, h: 1 },
  { top: 92, width: "20%", dur: 1.1, delay: 2.6, gap: 12.0, opacity: 0.4, h: 1 },
];

export function GreenSweeps() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-28 overflow-hidden">
      {/* breathing top glow */}
      <motion.div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg,transparent,${GREEN}55,transparent)` }}
        animate={{ opacity: [0.15, 0.6, 0.15] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {BEAMS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: b.top,
            height: b.h,
            width: b.width,
            opacity: b.opacity,
            background: `linear-gradient(90deg,transparent,${GREEN},transparent)`,
            boxShadow: `0 0 14px ${GREEN}, 0 0 28px ${GREEN}66`,
          }}
          initial={{ left: "-45%" }}
          animate={{ left: ["-45%", "115%"] }}
          transition={{
            duration: b.dur,
            ease: [0.45, 0, 0.2, 1],
            repeat: Infinity,
            repeatDelay: b.gap,
            delay: b.delay,
          }}
        />
      ))}
    </div>
  );
}
