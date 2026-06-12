import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin } from "lucide-react";
import { TelegramIcon } from "@/components/auth/BrandIcons";
import { Marquee } from "./Marquee";
import { BRAND } from "@/lib/config";

const EXPLORE = [
  { label: "Catalog", href: "/catalog" },
  { label: "AI Assistant", href: "/ai" },
  { label: "Promo Codes", href: "/promo" },
  { label: "Cart", href: "/cart" },
  { label: "Sign in", href: "/login" },
];

const TICKER = [
  "OASIS LUX",
  "DISTILLED LUXURY",
  "REALTIME DELIVERY",
  "TAJIKISTAN",
  "© 2026",
  "ALL RIGHTS RESERVED",
];

export function LandingFooter() {
  return (
    <footer id="contact" className="relative scroll-mt-20 border-t border-[var(--panel-border)] pt-16">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 sm:px-10 md:grid-cols-3">
        {/* brand + status */}
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={BRAND.icon} alt={BRAND.name} width={38} height={38} className="rounded-lg" />
            <span className="text-base font-bold">{BRAND.name}</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm text-fg-muted">{BRAND.tagline}.</p>
          <div className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-muted">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            All systems operational
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--panel-border)] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-accent">
            <MapPin className="h-3 w-3" /> Dushanbe · Tajikistan 🇹🇯
          </p>
        </div>

        {/* explore */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Explore</p>
          <ul className="mt-4 space-y-2.5">
            {EXPLORE.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-fg-muted transition hover:text-accent">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* contact */}
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-muted">Contact the maker</p>
          <p className="mt-4 max-w-xs text-sm text-fg-muted">
            Questions, partnerships or a custom build? Reach out directly:
          </p>
          <div className="mt-4 flex flex-col gap-2.5">
            <a
              href="https://t.me/amdklawm"
              target="_blank"
              rel="noopener noreferrer"
              className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:neon-border"
            >
              <TelegramIcon className="h-4 w-4 text-accent" />
              <span>
                Telegram <span className="text-fg-muted">·</span> <span className="text-accent">@amdklawm</span>
              </span>
            </a>
            <a
              href="mailto:messinaldos1488@gmail.com"
              className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:neon-border"
            >
              <Mail className="h-4 w-4 text-accent" />
              <span className="break-all">messinaldos1488@gmail.com</span>
            </a>
          </div>
        </div>
      </div>

      <div className="mt-14 border-t border-[var(--panel-border)] py-5">
        <Marquee items={TICKER} duration={32} />
      </div>
    </footer>
  );
}
