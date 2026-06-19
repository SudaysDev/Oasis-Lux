import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = { src?: string | null; name: string; size?: number; className?: string };

// Telegram/TikTok-style deterministic palette: same name → same gradient, every time.
const GRADIENTS = [
  "from-[#FF5E62] to-[#FF9966]", // coral
  "from-[#36D1DC] to-[#5B86E5]", // sky
  "from-[#A770EF] to-[#CF8BF3]", // violet
  "from-[#11998E] to-[#38EF7D]", // emerald
  "from-[#FC6076] to-[#FF9A44]", // sunset
  "from-[#4E54C8] to-[#8F94FB]", // indigo
  "from-[#F7971E] to-[#FFD200]", // gold
  "from-[#EB3349] to-[#F45C43]", // ruby
  "from-[#1FA2FF] to-[#12D8FA]", // cyan
  "from-[#DA22FF] to-[#9733EE]", // magenta
];

/** Stable index from a string (FNV-ish). */
function hashIndex(name: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % mod;
}

export function Avatar({ src, name, size = 40, className }: Props) {
  const initial = (name?.[0] ?? "O").toUpperCase();
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const gradient = GRADIENTS[hashIndex(name || "O", GRADIENTS.length)];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white",
        gradient,
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
