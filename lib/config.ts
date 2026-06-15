import type { Currency, Locale, SocialPlatform } from "@/types";

export const BRAND = {
  name: "OASIS LUX",
  short: "OASIS",
  tagline: "Distilled Luxury · Realtime Delivery",
  icon: "/brand-icon.png",
  accent: "#22d3ee",
} as const;

export const LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "tg", label: "Тоҷикӣ", flag: "🇹🇯" },
  { code: "kk", label: "Қазақша", flag: "🇰🇿" },
  { code: "uz", label: "Oʻzbekcha", flag: "🇺🇿" },
];
export const DEFAULT_LOCALE: Locale = "ru";

export const CURRENCIES: Currency[] = ["TJS", "USD", "RUB", "UZS", "KZT", "EUR", "GBP"];
export const DEFAULT_CURRENCY: Currency = "TJS";
export const CURRENCY_STORAGE_KEY = "oasis-currency";

/** Display symbol + conversion rate from the TJS base (1 TJS → rate × currency). */
export const CURRENCY_META: Record<Currency, { symbol: string; rate: number; prefix: boolean; label: string; flag: string }> = {
  TJS: { symbol: "смн", rate: 1, prefix: false, label: "Сомонӣ", flag: "🇹🇯" },
  USD: { symbol: "$", rate: 0.091, prefix: true, label: "US Dollar", flag: "🇺🇸" },
  RUB: { symbol: "₽", rate: 8.5, prefix: false, label: "Рубль", flag: "🇷🇺" },
  UZS: { symbol: "сўм", rate: 1180, prefix: false, label: "Сўм", flag: "🇺🇿" },
  KZT: { symbol: "₸", rate: 48, prefix: false, label: "Теңге", flag: "🇰🇿" },
  EUR: { symbol: "€", rate: 0.085, prefix: true, label: "Euro", flag: "🇪🇺" },
  GBP: { symbol: "£", rate: 0.072, prefix: true, label: "Pound", flag: "🇬🇧" },
};

export const SOCIALS: { key: SocialPlatform; label: string; prefix: string }[] = [
  { key: "telegram", label: "Telegram", prefix: "@" },
  { key: "instagram", label: "Instagram", prefix: "@" },
  { key: "tiktok", label: "TikTok", prefix: "@" },
  { key: "whatsapp", label: "WhatsApp", prefix: "+" },
];

/** Tajikistan map bounds + key cities (used by the 3D tracking map). */
export const TJ = {
  center: [68.787, 38.5598] as [number, number], // Dushanbe
  bounds: [
    [67.3, 36.6],
    [75.2, 41.1],
  ] as [[number, number], [number, number]],
  cities: [
    { name: "Dushanbe", lng: 68.787, lat: 38.5598 },
    { name: "Khujand", lng: 69.622, lat: 40.2833 },
    { name: "Bokhtar", lng: 68.78, lat: 37.8364 },
    { name: "Kulob", lng: 69.779, lat: 37.9111 },
    { name: "Khorog", lng: 71.556, lat: 37.4897 },
  ],
} as const;

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};
