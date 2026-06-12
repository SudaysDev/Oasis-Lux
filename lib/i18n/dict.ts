// Lightweight client-side translations. Locale lives in Redux (locale slice) and
// localStorage; `useT()` looks up keys here. Expand these maps per page over time.
import type { Locale } from "@/types";

type Dict = Record<string, string>;

const en: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.catalog": "Catalog",
  "nav.sell": "Sell an item",
  "nav.ai": "AI Assistant",
  "nav.orders": "Orders",
  "nav.favorites": "Favorites",
  "nav.messages": "Messages",
  "nav.promo": "Promo",
  "nav.settings": "Settings",
  "nav.admin": "Admin",
  "topbar.search": "Search luxury — perfumes, watches, brands…",
  "menu.profile": "My profile",
  "menu.orders": "Sales & purchases",
  "menu.favorites": "Favorites",
  "menu.wallet": "Wallet",
  "menu.settings": "Settings",
  "menu.logout": "Log out",
  "menu.upgrade": "Upgrade",
  "menu.freePlan": "Free plan",
  "promo.active": "Promo active",
  "promo.inactive": "No promo active",
  "promo.enter": "Enter code",
  "promo.clear": "Clear",
  "common.language": "Language",
};

const ru: Dict = {
  "nav.dashboard": "Главная",
  "nav.catalog": "Каталог",
  "nav.sell": "Продать товар",
  "nav.ai": "AI-ассистент",
  "nav.orders": "Заказы",
  "nav.favorites": "Избранное",
  "nav.messages": "Сообщения",
  "nav.promo": "Промокоды",
  "nav.settings": "Настройки",
  "nav.admin": "Админ",
  "topbar.search": "Поиск люкса — духи, часы, бренды…",
  "menu.profile": "Мой профиль",
  "menu.orders": "Продажи и покупки",
  "menu.favorites": "Избранное",
  "menu.wallet": "Кошелёк",
  "menu.settings": "Настройки",
  "menu.logout": "Выйти",
  "menu.upgrade": "Улучшить",
  "menu.freePlan": "Бесплатный план",
  "promo.active": "Активирован промокод",
  "promo.inactive": "Промокод не активирован",
  "promo.enter": "Ввести код",
  "promo.clear": "Очистить",
  "common.language": "Язык",
};

const tg: Dict = {
  "nav.dashboard": "Асосӣ",
  "nav.catalog": "Каталог",
  "nav.sell": "Фурӯши мол",
  "nav.ai": "AI-ёвар",
  "nav.orders": "Фармоишҳо",
  "nav.favorites": "Дӯстдоштаҳо",
  "nav.messages": "Паёмҳо",
  "nav.promo": "Промокодҳо",
  "nav.settings": "Танзимот",
  "nav.admin": "Админ",
  "topbar.search": "Ҷустуҷӯ — атриёт, соат, брендҳо…",
  "menu.profile": "Профили ман",
  "menu.orders": "Фурӯш ва харид",
  "menu.favorites": "Дӯстдоштаҳо",
  "menu.wallet": "Ҳамён",
  "menu.settings": "Танзимот",
  "menu.logout": "Баромад",
  "menu.upgrade": "Такмил",
  "menu.freePlan": "Нақшаи ройгон",
  "promo.active": "Промокод фаъол аст",
  "promo.inactive": "Промокод фаъол нест",
  "promo.enter": "Воридкунии код",
  "promo.clear": "Тоза кардан",
  "common.language": "Забон",
};

export const DICTS: Record<Locale, Dict> = { en, ru, tg };

export function translate(locale: Locale, key: string): string {
  return DICTS[locale]?.[key] ?? en[key] ?? key;
}
