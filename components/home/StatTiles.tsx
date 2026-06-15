"use client";

import { Coins, Heart, ShoppingBag, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import { useCart } from "@/hooks/useCart";
import { useFavorites } from "@/hooks/useFavorites";
import { useMoney } from "@/hooks/useMoney";
import { useT } from "@/hooks/useT";
import type { Profile } from "@/types";

export function StatTiles({ profile }: { profile: Profile }) {
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();
  const { money } = useMoney();
  const { t } = useT();

  const tiles: { label: string; value: string; icon: ComponentType<{ className?: string }> }[] = [
    { label: t("home.points"), value: String(profile.loyaltyPoints), icon: Coins },
    { label: t("home.cashback"), value: money(profile.cashbackBalance), icon: Wallet },
    { label: t("home.inCart"), value: String(cartCount), icon: ShoppingBag },
    { label: t("home.favorites"), value: String(favCount), icon: Heart },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div key={t.label} className="glass rounded-2xl p-4">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent">
              <Icon className="h-4 w-4" />
            </span>
            <p className="mt-3 text-2xl font-black">{t.value}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-muted">{t.label}</p>
          </div>
        );
      })}
    </div>
  );
}
