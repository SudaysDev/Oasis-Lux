"use client";

import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { formatPrice } from "@/lib/utils";

/** Currency-aware money formatter — converts a TJS-base amount to the user's chosen currency. */
export function useMoney() {
  const currency = useAppSelector((s) => s.locale.currency);
  const money = useCallback((amountTjs: number) => formatPrice(amountTjs, currency), [currency]);
  return { money, currency };
}
