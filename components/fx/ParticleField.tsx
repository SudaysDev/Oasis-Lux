"use client";

import { useMemo, useSyncExternalStore, type CSSProperties } from "react";
import { Particles, ParticlesProvider } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { Engine, ISourceOptions } from "@tsparticles/engine";

// "is mounted on the client" without setState-in-effect: server snapshot=false, client=true.
const noopSubscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

// ParticlesProvider requires a *stable* init callback across the app lifecycle,
// so this lives at module scope (the "fishka": stars drift & cling to the cursor).
const initEngine = async (engine: Engine) => {
  await loadSlim(engine);
};

const BASE_OPTIONS: ISourceOptions = {
  fullScreen: { enable: false },
  fpsLimit: 60,
  detectRetina: true,
  background: { color: "transparent" },
  particles: {
    number: { value: 70, density: { enable: true } },
    color: { value: ["#22d3ee", "#a855f7", "#e6f1ff"] },
    links: { enable: true, color: "#22d3ee", distance: 140, opacity: 0.22, width: 1 },
    move: { enable: true, speed: 0.6, direction: "none", random: true, outModes: { default: "out" } },
    opacity: { value: { min: 0.15, max: 0.7 } },
    size: { value: { min: 1, max: 3 } },
  },
  interactivity: {
    // track the pointer across the whole window even though the canvas sits behind the UI
    detectsOn: "window",
    events: {
      onHover: { enable: true, mode: ["grab", "attract"] },
      resize: { enable: true },
    },
    modes: {
      grab: { distance: 190, links: { opacity: 0.5 } },
      attract: { distance: 220, duration: 0.4, factor: 2.2, speed: 1 },
    },
  },
};

type Props = {
  id?: string;
  className?: string;
  style?: CSSProperties;
  /** Particle count override (e.g. lighter on mobile). */
  quantity?: number;
};

export function ParticleField({ id = "oasis-particles", className, style, quantity }: Props) {
  // Never render the canvas during SSR (avoids window access + hydration mismatch).
  const mounted = useIsClient();

  const options = useMemo<ISourceOptions>(() => {
    if (!quantity) return BASE_OPTIONS;
    return {
      ...BASE_OPTIONS,
      particles: {
        ...BASE_OPTIONS.particles,
        number: { value: quantity, density: { enable: true } },
      },
    };
  }, [quantity]);

  if (!mounted) return null;

  return (
    <ParticlesProvider init={initEngine}>
      <Particles id={id} options={options} className={className} style={style} />
    </ParticlesProvider>
  );
}

export default ParticleField;
