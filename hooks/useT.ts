"use client";

import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { translate } from "@/lib/i18n/dict";

/** Translation hook — reads the active locale from Redux and resolves keys. */
export function useT() {
  const locale = useAppSelector((s) => s.locale.locale);
  const t = useCallback((key: string) => translate(locale, key), [locale]);
  return { t, locale };
}
