import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = { src?: string | null; name: string; size?: number; className?: string };

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
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/40 to-accent-2/40 font-bold text-fg",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}
