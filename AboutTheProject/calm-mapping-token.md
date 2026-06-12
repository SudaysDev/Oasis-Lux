# ТЗ + План реализации: OASIS LUX — кибер-люкс маркетплейс (Таджикистан)

## Context (зачем это и что строим)

Друг заказал интернет-магазин для Таджикистана: распив парфюма, часы, очки. Текущий
репозиторий — пустой Next.js 16 скелет, который **сейчас даже не компилируется**:
[layout.tsx](my-app/app/layout.tsx#L4) импортирует `@/store/Provider`, которого не
существует. Полное ТЗ от заказчика лежит в
[ABOUTFULL.md](my-app/AboutTheProject/ABOUTFULL.md) + 23 макета-картинки в
`my-app/AboutTheProject/Maket/`. Иконка бренда (неоновый пакет со звездой) —
`my-app/AboutTheProject/Icon/image.png` (использовать именно её, НЕ иконки из макетов).

Цель: «имбовый» современный сайт уровня https://vision.spaace.io/ — тёмный кибер-люкс,
3D, glassmorphism, частицы на фоне, реакция на мышь, мощный масштабируемый бэкенд на
Supabase, ИИ-ассистент, живой трекинг по карте Таджикистана, промокоды, мультиязык.

**Бренд:** `OASIS LUX` (в макетах имена разнятся — Oasis Lux / Obsidian Neon / Luxe
Tajikistan; сводим к одному, легко переименовать в одном файле конфига). Тёмная тема по
умолчанию, неоновый cyan-акцент, монопространственные «терминальные» подписи.

### Решения заказчика (подтверждены)
| Тема | Решение |
|---|---|
| Уведомления о заказе | **Telegram-бот + Email** (оба бесплатные). In-app дублируем всегда. |
| ИИ-движок | **Google Gemini (free tier)** — мультимодальный (понимает фото), бесплатная квота. |
| База данных | **Заказчик создаёт проект на supabase.com и присылает URL + anon/service ключи.** |
| Трекинг курьера | **Реалистичная симуляция** маршрута/ETA + готовый крючок под реальный GPS позже. |

### Известные ограничения / где «бесплатно» не получится (важно знать заранее)
- **SMS на номер** — платно и ненадёжно в +992 → не используем (берём Telegram/Email).
- **Login по SMS-OTP** — это та же платная SMS. → На старте делаем **бесплатный OTP**:
  фиксированный dev-код / отправка кода через Telegram-бота, с архитектурой под реальный
  SMS/Telegram OTP позже. Телефон остаётся идентификатором (`+992` маска).
- **Instagram/TikTok push** — у них нет публичного API для рассылки. Ники собираем при
  регистрации (как просил заказчик) и используем для связи и витрины профиля, не для пуша.
- **Реальный GPS курьера** — нужен отдельный апп курьера; сейчас симуляция (решено выше).
- **Supabase phone-auth по SMS** — платно; поэтому auth строим на email/телефон+OTP(free).

---

## Технологический стек

**Уже стоит** (используем): Next.js `16.2.6` (App Router) · React `19.2.4` · TypeScript ·
Tailwind CSS v4 · `@reduxjs/toolkit` + `react-redux` · `@tanstack/react-query` ·
`react-hook-form` + `zod` + `@hookform/resolvers` · `react-hot-toast` · `lucide-react`.

**Ставим дополнительно:**
| Назначение | Пакет |
|---|---|
| Анимации/переходы | `framer-motion` (motion) |
| 3D (hero, просмотр товара) | `three` + `@react-three/fiber` + `@react-three/drei` |
| Частицы-«фишка» (звёзды тянутся к курсору) | `@tsparticles/react` + `@tsparticles/slim` + interaction `attract`/`repulse` |
| 3D-карта Таджикистана | `maplibre-gl` + `react-map-gl` (бесплатно, pitch/bearing-вращение, maxBounds=TJ) |
| Мультиязык en/ru/tg | `next-intl` |
| Supabase | `@supabase/supabase-js` + `@supabase/ssr` |
| ИИ (Gemini) | `@google/generative-ai` (только на сервере, в route handlers) |
| Email | `resend` (free tier) |
| Telegram | без SDK — Bot API через `fetch` в route handler |
| Графики (admin) | `recharts` |
| Конфетти (успех заказа) | `canvas-confetti` |
| Даты/ETA | `date-fns` |

> ⚠️ **Next.js 16 — НЕ тот, что в памяти модели.** Перед написанием кода роутинга/route
> handlers/server actions/middleware/proxy ОБЯЗАТЕЛЬНО читать
> `my-app/node_modules/next/dist/docs/01-app/...` (есть `15-route-handlers.md`,
> `07-mutating-data.md`, `16-proxy.md`, `05-server-and-client-components.md`,
> `13-fonts.md`, `14-metadata-and-og-images.md` и т.д.). Так требует
> [AGENTS.md](my-app/AGENTS.md).

---

## Архитектура

### Структура папок (root = `my-app/`, alias `@/*` → `./*`)
```
app/
  (marketing)/            landing «/», публичные
  (auth)/login, register
  (shop)/                 home, catalog, product/[id], cart, favorites, promo
  (account)/              profile, profile/[id], orders, order/[id]/track,
                          notifications, messages, messages/[id], settings, ai
  (admin)/admin/          dashboard, products, promo, logistics
  api/                    route handlers: orders, notify, ai, ai/promo, geo, telegram
  layout.tsx              провайдеры (Redux, ReactQuery, next-intl, theme, Toaster)
components/               ui/ (design-system), shop/, three/, map/, ai/, layout/, fx/
lib/                      supabase/(server,browser), gemini, telegram, email, geo, utils
store/                    Redux: slices (theme, locale, cart, favorites, ui, auth)
i18n/                     next-intl config + messages/{en,ru,tg}.json
hooks/                    useCart, useFavorites, useTheme, useLocale, useCursor, …
types/                    доменные типы (Product, Order, Promo, Profile, …)
supabase/                migrations/*.sql, seed.sql, policies.sql
```

### Слои данных
- **Server Components** — выборка данных по умолчанию (каталог, товар, профиль, заказы).
- **React Query** — клиентское состояние сервера (фильтры каталога, чат, нотификации).
- **Redux Toolkit** — UI-стейт: тема, язык, корзина, избранное, модалки/сайдбар, зеркало
  сессии. (Сначала чиним сломанный `@/store/Provider`.)
- **Supabase** — Postgres + RLS + Auth + Storage + Realtime.

---

## База данных (Supabase, ключевые таблицы + RLS)

`profiles` (id, username, full_name, avatar_url, banner_url, phone, role
[customer|seller|admin|courier], socials jsonb {telegram,instagram,tiktok,whatsapp},
telegram_chat_id, loyalty_tier, loyalty_points, cashback_balance, locale, theme) ·
`categories` (type: perfume|watch|glasses, parent_id) · `products` (seller_id, title,
brand, origin, base_price, currency, stock, tags[], rating, images[], attributes jsonb) ·
`product_variants` (type: volume|color, name, price_delta, stock) · `reviews`
(product_id, user_id, rating, text, photos[], helpful_count, verified_buyer) ·
`cart_items` · `favorites` · `orders` (status, subtotal, discount, delivery_fee, total,
promo_code, region, courier_id) · `order_items` · `deliveries` (courier_id, status,
origin/destination lat/lng, current pos, distance_remaining_km, eta_minutes, route
geojson) · `promo_codes` (code, type: percent|fixed|cashback, value, scope:
all|category|product, scope_ref, min_order, max_discount, expires_at, usage_limit,
used_count, is_active, ai_generated) · `promo_redemptions` · `notifications` (type, title,
body, data jsonb, read) · `conversations` + `messages` (attachments[], read) ·
`ai_messages` (role, content, attachments).

RLS: пользователь видит/меняет только своё; продавец — свои товары/заказы; admin — всё;
публичное чтение активных товаров/категорий/отзывов. Миграции и seed (демо-товары
парфюм/часы/очки, демо-промокоды, демо-курьеры) в `supabase/`.

---

## Ключевые системы

### 1. Интерактивный фон + реакция на мышь (на всём сайте)
- Глобальный слой `@tsparticles` (звёзды тянутся к курсору, физика — «фишка» из
  `AboutTheProject/fishka`), тема-зависимый, в `components/fx/ParticleField`.
- Кастомный курсор + glow-трейл, **magnetic buttons**, **tilt-cards**, mouse-tracking
  grid-mesh на hero (framer-motion `useMotionValue`/`useSpring`). Папка `components/fx/`.
- Свайперы на landing и home (горизонтальный showcase товаров).

### 2. 3D (как vision.spaace.io)
- `react-three-fiber`: вращающийся абстрактный флакон/часы на hero; 3D-вьюер на странице
  товара (кнопка «3D View»). Компоненты в `components/three/`.
- Карта: `maplibre-gl` (тёмный стиль), `maxBounds` = границы Таджикистана,
  pitch+bearing (вращение мышью), пульсирующие маркеры курьеров/маршрут. `components/map/`.

### 3. Аутентификация
- Телефон `+992` (маска) как идентификатор + OTP (free: dev-код/через Telegram) + чекбокс
  соглашения + поле промокода (валидация) + **минимум 1 соцник** (TG/IG/TikTok/WA) — zod
  `refine`. Вход «как админ» (роль admin). Левая панель логина — интерактивный canvas с
  плавающими glassmorphic-кнопками соцсетей; клик → мини-модалка с инпутом `@username`.

### 4. Уведомления (заказ → продавец/админ)
Route handler `app/api/orders` создаёт заказ → триггерит `app/api/notify`:
(a) **Telegram** боту продавца по `telegram_chat_id` (товар, кол-во, стоимость/итог/заказ,
имя+телефон курьера, остаток км, ETA); (b) **Email** через Resend; (c) строка в
`notifications` (in-app, Realtime). `lib/telegram.ts`, `lib/email.ts`. Продавец 1 раз
жмёт Start у бота (фиксируем chat_id).

### 5. ИИ (Gemini) — мини-чат, страница AI, поиск по фото, навигация
- Прокси на сервере `app/api/ai` (стрим токенов через ReadableStream → анимация печати).
- **Function calling / structured output**: инструменты `navigate(page)`,
  `search(query, filters)`, `recommend(productIds)`. «где мой профиль?» → navigate→`/profile`;
  «есть iphone 16 pro?» → search → `/catalog?search=...&filters=...`. Клиент исполняет action.
- Мультимодал: загрузка фото → Gemini vision → определить товар → search.
- Плавающий мини-чат на всех страницах + полноценная `/ai` (как Gemini/ChatGPT, аплоад фото).
- **Админ-генератор промокодов** `app/api/ai/promo`: NL-промпт → structured JSON (code,
  value, constraints, expiry, scope) → превью-схема → «Activate» вставляет в `promo_codes`.
- **Админ-копилот** — отдельный помощник в админке (тоже принимает фото).

### 6. Промокоды
- При регистрации (поле invite/promo) + страница `/promo` (геймифицированные ваучеры,
  copy-code с частицами, locked-купоны за майлстоуны).
- Типы: percent / fixed / cashback / scope=категория|товар. Товары со скидкой — бейджи
  сверху; **чем больше скидка — тем «радужнее» бейдж** (90% = вау, жирный градиент).
- Управление — в админке (ручное + AI-генератор).

### 7. Мультиязык + темы
- `next-intl`, локали en/ru/tg, переключение в navbar и в `/settings`, персист в
  profile+cookie. Тема dark(деф)/light — CSS-переменные, тумблер (звезда/солнце), персист.

---

## Карта страниц (20+; дизайн — свести макеты к идеальной середине, иконка из `Icon/`)

| Маршрут | Страница | Суть (детали — в ABOUTFULL.md) |
|---|---|---|
| `/` | Landing | Длинный: hero 3D + grid-mesh за мышью, stats-счётчики, showcase-свайпер, footer-тикер |
| `/login`, `/register` | Auth | Асимметрия: справа форма, слева интерактивные соц-кнопки + модалки ников |
| `/home` | Home | Дашборд: сайдбар, приветствие, Live Courier Tracker (3D-карта), Trending/Recently/Drops, свайперы |
| `/catalog` | Каталог | 2 колонки, 100+ вложенных фильтров, поиск по фильтрам, сортировки, infinite scroll, view-toggle |
| `/product/[id]` | Товар | Галерея (неск. фото) + 3D-вьюер, варианты (ml/цвета меняют цену), аккордеоны, отзывы с фото, рекомендации-свайпер (клик → обновляет страницу) |
| `/cart` | Корзина | Список + sticky-итог, кол-во с bounce, промо-поле, пустое состояние со слайдером |
| `/favorites` | Избранное | Сетка, particle-анимация сердца, статус-теги, layout-переходы при удалении |
| `/checkout` | Оформление | Слева доставка (регион TJ), справа 3D-карта (CSS flip на CVV), валидация шагов |
| `/order/[id]/track` | Успех + трекинг | Конфетти, Order ID, имя+телефон курьера, км/ETA-тикеры, состав заказа TJS, пайплайн статусов, **3D-карта Таджикистана** (вертится), чеки/модерация |
| `/orders` | История заказов | Все транзакции, клик → модалка с инфо, прогресс-трекинг |
| `/profile`, `/profile/[id]` | Профиль | LinkedIn-баннер, edit, аватар, соц-бейджи, **User Sells**, лояльность; кнопка «написать» → messages |
| `/notifications` | Уведомления | Лента + фильтры, мини-карты в заказах, pulsing unread, swipe-to-dismiss, mark-all |
| `/ai` | AI-ассистент | Чат как Gemini/ChatGPT, стрим-печать, аплоад фото, встроенные карточки товаров, редиректы |
| `/messages`, `/messages/[id]` | Сообщения / чат | Master-detail inbox + 1-на-1 чат с продавцом (Realtime, вложения, чекмарки) |
| `/promo` | Промокоды | Ваучеры, copy-code+частицы, locked-купоны |
| `/settings` | Настройки | Безопасность, тема (тумблер), язык (en/ru/tg), валюта (TJS/USD/RUB), каналы уведомлений |
| `/admin` | Admin Dashboard | 4 KPI + line-charts, таблица заказов со статус-дропдауном, live-лог, копилот |
| `/admin/promo` | AI Promo Generator | NL-консоль → схема-превью → Activate |
| `/admin/products` | Inventory | Таблица + «+Add» (full-screen drawer), варианты во вложенных строках |
| `/admin/logistics` | Логистика | Полноэкранная 3D-карта TJ + сайдбар доставок (курьеры, ETA, координаты, чат) |

---

## Поэтапный план (рекомендуемый порядок сборки)

- **Фаза 0 — Фундамент:** прочитать Next 16 docs; поставить библиотеки; починить
  `@/store/Provider` (создать `store/`); провайдеры (Redux, ReactQuery, next-intl, theme);
  дизайн-система (токены, glassmorphism, неон, иконка бренда); shell (navbar/sidebar/footer);
  глобальный particle-фон + кастомный курсор/mouse-fx; темы dark/light; i18n каркас.
- **Фаза 1 — Auth & DB:** Supabase-клиенты + миграции + RLS + seed; auth-флоу
  (телефон+OTP free, admin-вход, ≥1 соцник); страницы login/register с интерактивной
  левой панелью и модалками ников.
- **Фаза 2 — Ядро магазина:** Landing (длинный), Home, Catalog (100+ фильтров),
  Product/[id] (галерея+3D+варианты+отзывы+рекомендации), Cart, Favorites.
- **Фаза 3 — Чекаут & трекинг:** Checkout (3D flip-карта), Order success+tracking
  (3D-карта TJ симуляция), Order history, система уведомлений (Telegram+Email+in-app).
- **Фаза 4 — ИИ:** Gemini-интеграция, страница AI (стрим+фото+карточки), плавающий
  мини-чат, навигация/поиск по интенту, поиск по фото.
- **Фаза 5 — Соц/мессенджинг:** Profile/[id]+User Sells+edit+баннер, Messages+чат
  (Realtime), отзывы.
- **Фаза 6 — Админка:** Dashboard (KPI+charts+таблица), AI-генератор промо, Inventory
  (drawer+варианты), Logistics-карта, копилот; промокоды (страница + при регистрации +
  бейджи скидок).
- **Фаза 7 — Полировка:** Settings полностью, дозаполнить i18n, адаптив, перф, деплой.

---

## Verification (как проверяем, что работает)

- После каждой фазы: `npm run dev` в `my-app/`, открыть страницы, проверить
  интерактив/анимации/3D/мышь визуально (через `/run` или `/verify`).
- `npm run build` + `npm run lint` — без ошибок (особенно типы Next 16 server/client).
- Auth: регистрация требует ≥1 соцник; admin-вход даёт доступ к `/admin`.
- Заказ → проверить, что в Telegram пришло сообщение (тест-бот) + Email + in-app строка.
- ИИ: «где мой профиль?» → редирект на `/profile`; «есть iphone 16 pro?» → каталог с
  фильтром; аплоад фото → поиск. Админ-промпт → промокод создан и активен.
- Карта: ограничена Таджикистаном, вращается, маркеры курьера движутся, км/ETA идут.
- i18n: переключение en/ru/tg меняет тексты; тема dark/light переключается и сохраняется.
- `/code-review` перед завершением крупных фаз.

## Что нужно от заказчика (по ходу)
1. Supabase: URL + anon key + service_role key (создать проект на supabase.com).
2. Gemini API key (бесплатно, ai.google.dev — 1 минута).
3. Telegram: токен бота от @BotFather (бесплатно) — для уведомлений.
4. Resend API key (бесплатно) — для Email (опционально, можно позже).
