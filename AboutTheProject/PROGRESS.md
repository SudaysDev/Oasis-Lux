# OASIS LUX — Build Progress / Handoff

> Brand: **OASIS LUX** · cyber-luxury, dark default + light · accent neon cyan `#22d3ee`.
> Full TZ/plan: `C:\Users\Sudays\.claude\plans\calm-mapping-token.md` (read it first).
> Stack: Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · Redux Toolkit ·
> React Query · Supabase · Gemini (AI) · framer-motion · three/r3f · tsparticles ·
> maplibre · next-intl · resend · recharts. ⚠️ Next 16 is non-standard — read
> `node_modules/next/dist/docs/01-app/**` before coding (AGENTS.md).

## ✅ DONE — Phase 0 skeleton (build passes: `npx next build` → 27 routes OK)
- Full folder/route tree scaffolded (all pages are **stubs** = "X · coming soon").
- Core wiring (functional):
  - `types/index.ts` — all domain types.
  - `lib/config.ts` (BRAND, LOCALES en/ru/tg, CURRENCIES, SOCIALS, TJ map bounds/cities, env)
  - `lib/utils.ts` (cn, formatPrice TJS/сомонӣ, formatDistanceKm, formatEta, slugify)
  - `lib/supabase/{client,server}.ts` (@supabase/ssr; server uses async `cookies()`)
  - `store/index.ts` (slices: theme, locale+currency, cart, favorites, ui, auth) + `store/hooks.ts`
  - `providers/index.tsx` (Redux + React Query + Toaster) → used in `app/layout.tsx`
  - `app/globals.css` — dark/light CSS-var tokens + `.glass .neon-text .neon-border .grid-mesh`
  - `app/layout.tsx` — brand metadata + no-flash theme script (`localStorage 'oasis-theme'`)
  - Brand icon copied to `app/icon.png` + `public/brand-icon.png` (default favicon removed)
- Stubs awaiting implementation: `app/api/*/route.ts` (return `{todo:true}`),
  `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `seed.sql`, `i18n/messages/{en,ru,tg}.json`.
- `.env.example` written. Real keys in `.env.local` (Supabase URL + anon + **management
  access token** `SUPABASE_ACCESS_TOKEN` → can create tables via Supabase CLI/Mgmt API).

## ✅ DONE — Phase 1a: Auth (login + register, fully working)
- **DB (identity slice) applied** to `onobgfvujbjrqavovgkm` via `supabase/apply.mjs`
  (Management API + `SUPABASE_ACCESS_TOKEN`): tables `profiles`, `phone_otps`,
  `promo_codes`, `promo_redemptions` (`0001_schema.sql`), RLS (`0002_rls.sql`),
  5 demo promo codes (`seed.sql`: WELCOME10/OASIS20/CASHBACK15/WATCH50/VIP90).
  `npm run dev` → reusable `node supabase/apply.mjs` re-applies migrations+seed.
- **Auth flow (free, no paid SMS):** phone `+992` is the identity; OTP proves
  ownership. Each phone ↔ a Supabase auth user with a *synthetic email*
  (`992…@phone.oasislux.app`) + *deterministic HMAC password* (`AUTH_SECRET`) used
  only to mint a session after the OTP gate. `lib/auth/server.ts` (server-only),
  `lib/supabase/admin.ts` (service-role), `app/(auth)/actions.ts`
  (`requestOtp` / `loginAction` / `registerAction` / `logoutAction`).
  - Dev OTP: `DEV_OTP_ECHO=true` echoes & auto-fills the token; master `DEV_OTP=000000`
    always verifies. Admin via `ADMIN_PHONES` (default `+992900000000`) → role `admin`.
  - Register enforces ≥1 social (zod) + terms; optional invite code grants points/cashback.
- **UI** (merged "golden middle" of the mockup, brand icon from `Icon/`):
  split screen — left interactive "CONNECT IDENTITY" panel (floating glass social
  orbs → nickname modals), right dark "SECURE TERMINAL" form. Global tsparticles
  field (cursor-attract "fishka"), theme toggle, framer-motion. New components:
  `components/fx/ParticleField`, `components/auth/{BrandIcons,ThemeToggle,NicknameModal,
  SocialConnect,SocialOrbits,AuthForm,AuthExperience}`. `lib/auth/shared.ts` (client+server).
- Verified: `npx next build` (27 routes, /login+/register dynamic) + `eslint` clean;
  Supabase create-user→profile→sign-in smoke test passed; pages render with no errors.
  ⚠️ Still worth a manual browser click-through of submit (server-action transport).
- ⚠️ Lib gotchas found: lucide-react 1.14 has **no brand icons** (used inline SVGs);
  tsparticles v4 uses `<ParticlesProvider init>`+`<Particles>` (no `initParticlesEngine`);
  eslint is strict (`react-hooks/refs`, `set-state-in-effect`) — fixed `providers/index.tsx`
  to lazy `useState`. Added dep `server-only`.

## ✅ DONE — Phase 2a: Landing page (`/`, long & animated)
- `app/page.tsx` composes `components/landing/*`: `LandingNav` (blur-on-scroll, cart
  counter from Redux, theme toggle, Enter button), `Hero` (mouse-tracked grid-mesh +
  spotlight, headline, CTAs) with `Hero3D` (react-three-fiber rotating glass flacon,
  drag-to-rotate, gated by `hooks/useIsClient`), brand `Marquee`, `StatsSection`
  (count-up on view), `CategoriesSection`, `ShowcaseSection` (Swiper + quick-add →
  Redux cart + rainbow discount badges, bigger %→louder), `FeaturesSection`,
  `HowItWorks`, `CoverageMap` (stylized TJ network w/ pulsing city hotspots),
  `CtaSection`, `LandingFooter` (status, TJ badge, **contact: TG @amdklawm + email
  messinaldos1488@gmail.com**, copyright ticker). Global cursor-attract `ParticleField`.
- **No stock product photos exist** → visuals are procedural: `components/landing/ProductArt.tsx`
  (neon-glass SVG perfume/watch/glasses, hue-rotated per card) + the r3f flacon. Swap to
  real `<Image>` from `/public/products/` later. Demo data: `lib/landing-data.ts`.
- Verified: `next build` (/ is static) + `eslint` clean; page renders all sections + contacts.
- Gotcha: Tailwind v4 important is suffix (`px-6!`), not `!px-6` — avoided it. See [[lib-gotchas]].

## ✅ DONE — Phase 2b: Home dashboard + site-wide auth gating
- **Auth gating infra:** `lib/auth/session.ts` (`getCurrentProfile` cached, `requireUser`
  → redirect `/login`); `app/actions/session.ts` (`getMyProfile`, `logout`);
  `components/system/AuthSync` mirrors the session into Redux `auth` slice (mounted in
  `providers/index.tsx`). Hooks: `hooks/{useAuth,useCart,useFavorites}` — **add-to-cart &
  favorites now require login** (toast + redirect to `/login` when signed out). Landing
  showcase + all product cards use the shared, gated `components/shop/ProductCard`.
- **`/home` dashboard** (`app/(shop)/home/page.tsx` → `requireUser()` → `HomeDashboard`):
  collapsible glowing `components/app/Sidebar` (role-aware Admin link, logout), topbar
  (mobile drawer, search, notifications, theme, avatar), `GreetingBanner` (name + tier +
  loyalty offers ticker), `StatTiles` (points/cashback/cart/favorites), `LiveTracker`
  (tilted stylized TJ map, moving courier dot + live km/ETA countdown), and `ProductRow`
  swipers (Trending / Exclusive drops / Recently viewed) with **React-Query skeleton
  loaders** and quick variant pickers.
- Verified end-to-end: signed-out `/home` → 307 `/login`; signed-in → full dashboard
  renders (name, tracker, rows, sidebar, loyalty). `next build` + `eslint` clean.
- Promo/invite bonus on `/register` already works (don't rebuild) — see Phase 1a.

## ✅ DONE — Phase 3: Plans, AI, UX fixes (build OK: 32 routes)
- **Plans/billing:** `lib/plans.ts` is the single source (free/pro/elite + features +
  `isPaidPlan`/`PLAN_RANK`). New `/billing` page (`components/billing/{BillingView,
  PlanCheckout}`) — plan cards + mock 3D card checkout (flips on CVV) that writes
  `profiles.plan` via `updateProfile`. Landing now has `components/landing/PricingSection`.
  **Removed free plan self-upgrade** from `EditProfileModal` (plan is read-only there +
  "Upgrade"→`/billing`). ProfileMenu "Upgrade"→`/billing`.
- **AI Concierge chat — FREE for all (Phase 3.1 fix):** `/ai` = `components/ai/AiAssistant`
  — Gemini chat, **NOT gated** (owner clarified the chat is free; only the *listing/cover
  generation* in SellForm is Pro). Features: saved chat history (`lib/ai-history.ts`,
  localStorage per user, sidebar w/ delete), greeting "Привет {name}", markdown rendering
  (`components/ai/Markdown.tsx`, dep-free), animated message send, "Thinking…" dots,
  pulsing mesh-gradient bg, **voice input** (Web Speech API), **photo upload** (multimodal),
  streaming reveal, disclaimer line, `ACTION:` → navigate/search.
- **`app/api/ai/route.ts`** = multimodal Gemini chat, model fallback list. **`/api/ai/listing`**
  (SellForm AI fill) stays **Pro-gated** (402) — that IS the paid feature.
- ⚠️ **GEMINI MODEL FIX:** this key only exposes **`gemini-2.5-flash`** (and `-lite`);
  `gemini-1.5/2.0-flash` 404. Both routes now try `["gemini-2.5-flash","gemini-2.5-flash-lite",
  "gemini-2.0-flash"]`. That dead model name was the "AI generation failed" cause.
  ProGate (`components/ai/ProGate`) is still used by SellForm only.
- **UX fixes:** new `.popover` CSS (opaque, readable on light mode) replaces `glass` on
  Notifications/Profile/EditProfile modals. `.theme-anim` class on `<html>` (added by
  ThemeToggle for 550ms) → smooth dark/light crossfade + sun/moon icon spin. Cart/notif
  badges now `text-white` (+glow). ProductCard + Featured swiper link to `/product/[id]`.
  Layout `SearchBar` (live dropdown: ProductArt thumb + title + price → product page).
  Home BrowseSection filters got lucide icons. SellForm: size amount+unit (ml/g/pcs/cm),
  emoji picker + **bold**/*italic* toolbar (markdown into textarea).

## ✅ DONE — Phase 3.2: AI corrected + Oasis Helper (build OK)
- **AI Assistant is now Gemini-style ONE long chat** (owner: NOT a sidebar of chats).
  `components/ai/AiAssistant.tsx` rewritten: model selector (Flash=`gemini-2.5-flash`,
  Pro=`gemini-2.5-pro`), **"+" menu** (attach photo / generate image) replacing the photo
  icon, single persisted thread (`oasis-ai-thread:{uid}`), voice, markdown, streaming,
  greeting, disclaimer. **Free** (no gate).
- **Real AI image generation:** `app/api/ai/image/route.ts` (`gemini-2.5-flash-image` →
  data URL; 429/quota handled). Wired into the "+" menu.
- **Oasis Helper** (`components/ai/OasisHelper.tsx`, mounted in DashboardShell → site-wide):
  floating bottom-right launcher, panel with Чат/История tabs, **multi-chat history**
  (`lib/ai-history.ts`, `oasis-ai-chats:{uid}`), new-chat button, photo, thinking dots,
  markdown, NL→`ACTION`→navigate/`/catalog?q=`. No plan (it's just a helper).
- **BUG FIX:** FeaturedCarousel swiper "Add to cart" now respects stock (was infinite-add).
- Available image/text models for this key: `gemini-2.5-flash/-pro/-flash-lite`,
  `gemini-2.5-flash-image`, `imagen-4.0-*` (predict). 1.5/2.0-flash 404 — see [[lib-gotchas]].

## ✅ DONE — Phase 3.3: AI polish, categories, promo (build OK)
- **AI Assistant reworked to true Gemini feel:** wider (`max-w-4xl`), AI answers render as
  PLAIN text (no bubble/avatar), user prompts = light right bubble (no avatar), hidden
  scrollbar (`.no-scrollbar`), smaller fonts. Bottom bar now holds **model selector**
  (OASIS Flash = free / OASIS **Pro** = gated behind a paid plan → ProGate), **thinking
  level Standard/Extended** (wired to `/api/ai` → system prompt + maxOutputTokens), and a
  **generation-mode toggle**. **Auto image-gen** when the prompt matches `/generate|сгенерир|
  нарисуй/`. `/api/ai` enforces Pro-model gating (402) + thinking level.
- **Categories (real DB GET):** migration `0006_categories.sql` → `categories` table (15
  sections + 55 subcategories, admin-write RLS) + `products.category` / `products.tags[]`.
  `lib/data/categories.ts` (fetch+group). `components/sell/CategorySelect.tsx` = multi-tag
  picker (brand-style) used in SellForm — replaces the 3 hardcoded types. `type` is derived
  from tags for the neon art / DB enum. **Apply migrations: `node supabase/apply.mjs`.**
- **SellForm upgrades:** size = amount + **unit pills** (ml/g/pcs/cm/kg/L/—, killed the ugly
  native select); **40+ colors**; description is now a **contentEditable rich editor**
  (real bold/italic/list via `document.execCommand`, `.rich-editor` CSS) + bigger emoji set.
- **Promo indicator (owner's repeated ask):** `promo` redux slice + `lib/promo-codes.ts`
  (demo codes) + `components/app/PromoStatus.tsx` in the left sidebar → "АКТИВИРОВАН
  ПРОМОКОД: CODE −N%" or "ПРОМОКОД НЕ АКТИВИРОВАН", apply/clear, persisted via StoreSync.

## ✅ DONE — Phase 3.3: live products + catalog + i18n (build OK)
- **Live products everywhere:** `lib/data/products.ts` (`fetchActiveProducts`) + `hooks/useLiveProducts`
  (live DB listings prepended to `DEMO_PRODUCTS`). `DemoProduct` gained `image?`/`tags?`/`isLive?`.
  ProductCard renders the real `image` when present (else neon ProductArt). Home rows, SearchBar
  (searches title/brand/tags, shows photo) and the catalog all use it → a user's published item
  now appears on home/search/catalog immediately.
- **Catalog built** (was a stub): `components/shop/CatalogView` — sticky filter sidebar (search,
  max-price slider, category tree from DB), sort (newest/popular/price), animated grid. Reads
  `?q=`/`?cat=` (passed from the server page via `key` + props — avoids the strict
  set-state-in-effect lint). `/catalog` = requireUser + DashboardShell + CatalogView.
- **i18n (client, lightweight):** `lib/i18n/dict.ts` (en/ru/tg maps), `hooks/useT` (reads
  `locale` slice), `components/app/LanguageSwitcher` (flag dropdown, persists to
  `oasis-locale`, sets `<html lang>` via effect). Mounted in DashboardShell topbar + LandingNav.
  StoreSync hydrates saved locale on load. Translated the shared chrome (Sidebar nav, topbar
  search, ProfileMenu, PromoStatus). ⚠️ Per-page body copy (landing hero, dashboard, billing, AI)
  still hardcoded — translate incrementally by adding keys to `dict.ts` + `useT`.
- next-intl is installed but NOT used (we went client-dict to avoid the server refactor).

## ✅ DONE — Phase 3.4: catalog filters + image fallback + AI chat sync (build OK)
- **Catalog overhaul** (`components/shop/CatalogView`): left filter column with SORT moved into it,
  neon dual-handle **PriceRange** slider (`components/shop/PriceRange` + `.range-neon` CSS),
  multi filters — categories (tree), **brand** (search + checkboxes), **color** swatches (matches
  real variant colours), **size/volume** chips (derived), **condition** + Discounts/In-stock toggles,
  and **pagination** (12/page). `DemoProduct` + `lib/data/products` now carry `colors/size/condition/createdAt`.
- **AI image-gen "quota" bug**: root cause = free Gemini key blocks image gen (429) and Imagen is
  paid-only (see [[lib-gotchas]]). `/api/ai/image` now returns `{quota:true}`; the assistant falls
  back to a **client canvas poster** (`lib/poster.ts`) so generation always yields an image.
- **AI chat sync**: `AiAssistant` now mirrors its thread into the shared `oasis-ai-chats` store
  (so the Oasis Helper history lists assistant chats too) and opens a specific chat via `/ai?chat=<id>`.
  Helper history click → `router.push('/ai?chat=id')` (opens in the assistant, not the helper).

## ✅ DONE — Phase 3.3: live products, catalog, i18n, currency (build OK)
- **Live products everywhere:** `lib/data/products.ts` + `hooks/useLiveProducts` merge real
  seller listings (DB `products`) in front of the demo seed → they now show on Home rows,
  Catalog grid and the top SearchBar. `ProductCard` renders the uploaded cover image when present.
- **Catalog overhaul** (`components/shop/CatalogView.tsx`): filters for price (custom
  `PriceRange` dual-handle slider — replaced the ugly native one), status (discounts/in-stock/
  condition), category tree (real GET), brand (search + checkboxes), colour swatches,
  size/volume; **sort dropdown moved to the RIGHT above the grid**; pagination (12/page).
- **i18n** (`lib/i18n/dict.ts` + `hooks/useT` + `components/app/LanguageSwitcher` in the topbar):
  **5 languages en/ru/tg/kk/uz** with flags, Redux `locale` + localStorage + `<html lang>`,
  hydrated on boot in StoreSync. Nav, topbar, profile menu, promo, settings strings translated.
- **Settings page is full** (`components/settings/SettingsView`, per ТЗ blocks): Account &
  security (phone + linked social badges + edit-profile link), Appearance (tactile dark/light
  Switch w/ moon/sun), Localization (5 langs + 7 currencies), Notifications (master + per-type
  toggles + Telegram/Instagram/WhatsApp delivery-alert channels, persisted to `oasis-notif-prefs`),
  Plan & subscription (current plan + Upgrade/Manage → /billing). Reusable `Switch` component.
- **Currency** (`lib/config.ts` `CURRENCY_META` + `hooks/useMoney`): TJS/USD/RUB/UZS/KZT/EUR/GBP
  with REAL symbols ($, ₽, сўм, ₸, €, £, смн) + conversion. `formatPrice` is TJS-base→currency.
  All prices + the catalog price slider follow the chosen currency. Set in the new **Settings
  page** (`components/settings/SettingsView`: theme + language + currency), persisted & hydrated.
- **AI chat history fix:** assistant is backed by the shared `oasis-ai-chats` store; the helper
  lists them; clicking a history item → `/ai?chat=<id>` and the page `key` remounts the
  assistant so the SAVED chat actually loads (was opening empty).
- **AI image quota:** free Gemini tier blocks image gen (429) → `lib/poster.ts` `makePoster`
  renders an on-brand stylized canvas cover so "generate image" always returns something.

## ✅ DONE — Phase 4: product/[id] FULL page (build OK: 34 routes)
- **DB:** migration `0007_product_reviews.sql` → `product_reviews` (product_id is **text**
  so BOTH demo seeds "p1"/"w2" and live uuid listings share one table) + `product_review_likes`
  (helpfulness). RLS public-read / author-write. `verified_buyer` col defaults false (flips
  once orders land). **Applied via `node supabase/apply.mjs migrations/0007_product_reviews.sql`.**
- **Data layer:** `lib/data/product-reviews.ts` (fetch/upsert/delete/like). `lib/data/products.ts`
  gained `fetchProductDetail` (live uuid → full row: all images, html description, seller_id,
  category) + `fetchSellerMini`. New type `ProductReview`.
- **Page** `app/(shop)/product/[id]/page.tsx` = requireUser + DashboardShell + `<ProductDetail key={id}>`
  (the `key` remounts on navigation so clicking a recommendation reloads with that product's data).
- **`components/shop/ProductDetail.tsx`** (client orchestrator): resolves demo seed synchronously,
  live listings via fetch (no set-state-in-effect — derived state + `key` remount). Breadcrumb,
  title/brand, animated rating→#reviews anchor, live in-stock pulse, discount badge (rainbow tiers),
  **dynamic price** (perfume **volume selector** 2/5/10/100ml changes price live; watch/glasses
  **colour swatches** w/ real hexes). Qty stepper (stock-clamped), **Add to cart** (variant-aware,
  uses cart `addRaw`), **Buy now** (→ /cart), **Message seller** (→ /messages/[sellerId]), favourite.
  Trust strip, seller card (live → /profile/[id], demo → "OASIS LUX official"), description
  (sanitised seller HTML), 3 **accordions** (specs / ingredients-materials / TJ shipping table).
- **`ProductGallery.tsx`**: big stage + thumbnails (layoutId active indicator). Real photos when
  present, else fabricated neon-art "angles" (hue-rotated). **3D View** toggle = pointer drag-to-rotate
  (rotateX/Y w/ perspective) + reset. Discount flag overlay.
- **`ProductReviews.tsx`**: real backend reviews — star input, **photo upload** (reuses `uploadMedia`,
  max 4), rating distribution bars, **Helpful** like toggle, verified-buyer badge, edit/delete own.
- **Recommendations** swiper at the bottom (same-type first, then top-rated) + "View all" → catalog.
- ⚠️ Still open from this block (separate phase): **Order/checkout with card** + the post-order
  **tracking page** (3D TJ map, seller Telegram/IG ping, 15-min cancel window). Order CTA currently
  routes Buy-now → /cart (checkout flow not built yet).

## ✅ DONE — Phase 5: Cart + Favorites pages (build OK: 31 routes)
- **Cart** `app/(shop)/cart/page.tsx` → `components/shop/CartView` (was a stub). Left line-item list
  (image or `ProductArt` fallback via `useLiveProducts` lookup, title, `Variant: …`, unit price,
  **bounce quantity stepper**, line total) + **sticky Summary** (subtotal, "Shipping (Dushanbe
  Logistics) · Calculated at checkout", promo discount row, animated Total). **Promo field** wired to
  the shared `promo` redux slice + `oasis-promo` localStorage (same codes as sidebar `PromoStatus`,
  loading spinner). Glowing **Proceed to Checkout** → toast (checkout not built yet). **Trash → micro-modal
  confirm**. **Empty state** + recommendation Swiper.
  - Stock rule honoured ([[stock-decrement-rule]]): stepper `+` disabled once total cart qty for that
    productId hits `product.stock` (shared across variants); never writes DB stock.
- **Favorites** `app/(shop)/favorites/page.tsx` → `components/shop/FavoritesView` (was a stub). Header
  "My Wishlist" + count chip + bulk **Clear wishlist** / **Add all to cart** (skips out-of-stock /
  cart-maxed). Grid reuses shared `ProductCard` (status tags + discount badge + heart already built),
  `AnimatePresence layout` blur-out on removal. Empty state.
- **Infra:** added `clearFavorites` reducer + `clearFavoriteRows` persistence + `useFavorites().clearAll`.
- **Cart/Wishlist v2 (popular-store features):** cart — **save for later** (→ wishlist), **free-delivery
  progress bar** (≥500 смн), **"You save"** line (item discounts + promo), **out-of-stock** lines
  (greyed, unselectable, excluded from total/checkout), recommendations row, line vs unit count fixed.
  Wishlist — **sort** (recent/price/rating) + **filter chips** (All/In stock/On sale) with counts.

## ✅ DONE — Phase 6: Checkout + Orders + live tracking (build OK: 36 routes)
- **DB:** `0008_orders.sql` → `orders` + `order_items` (RLS: buyer & seller read, buyer writes/cancels).
  Order carries courier, distance/eta, origin/destination latlng, paid_at, **cancel_deadline**,
  **stock_settled**. **Applied via `node supabase/apply.mjs migrations/0008_orders.sql`.**
- **`lib/data/orders.ts`:** types + `fetchOrder`/`fetchMyOrders`/`cancelOrder` + pure helpers
  (REGION_META fees/distance per TJ city, `makeCourier`, `regionLogistics`, `canCancel`, `CANCEL_WINDOW_MIN=15`).
- **`POST /api/orders`** (server, cookies auth): recomputes money server-side (never trusts client),
  generates courier/ETA/destination, inserts order+items, **pings seller** (notification row via admin +
  best-effort Telegram DM if `telegram_chat_id`). **`POST /api/orders/settle`** (admin): lazy 15-min
  stock settlement — see [[stock-decrement-rule]].
- **Checkout** `/checkout` (`components/checkout/CheckoutView`): delivery form (name, +992 mask, region,
  address) + **3D payment card** (Alif green / Dushanbe City red-blue toggle, live number/name/expiry,
  **flips on CVV focus**), order summary (reads the cart's saved selection via `CHECKOUT_SELECTION_KEY`
  sessionStorage), "Pay" → authorizing spinner → creates order → removes paid lines from cart → /order/[id]/track.
  Cart's "Proceed to Checkout" now saves the selection + routes here (no more dead toast).
- **Tracking** `/order/[id]/track` (`components/order/OrderTracking`): confetti banner, **3D-tilted TJ map**
  with cities + animated courier marker moving hub→region, **live km + ETA countdown**, status pipeline
  (placed→…→fulfilled), courier card (call link), itemised totals, **15-min cancel window** w/ live mm:ss
  countdown → cancel (then locked). Calls settle on load.
- **Orders history** `/orders` (`components/order/OrdersView`): list of all orders w/ status badge, units,
  region, relative date, total → links to tracking.
- ⚠️ Future polish: multi-seller order splitting (one seller_id per order today); cheque upload +
  courier/buyer moderation on the tracking page.

## ✅ DONE — Phase 6.1: real map, transactions, polish (build OK: 37 routes)
- **Real interactive map** (`components/order/RouteMap.tsx`, maplibre-gl): free OSM raster tiles (no key),
  **drag · rotate · tilt (pitch 55) · zoom**, NavigationControl, dark "cyber" canvas filter (globals.css
  `.route-map`), neon GeoJSON route line + 🏬/📍 markers + animated 🚚 courier marker. Replaced the flat SVG.
  Coordinates are real (`REGION_META` city coords); distance/ETA now computed by **haversine** (`lib/data/orders`
  `haversineKm`/`lerpLatLng`/`regionLogistics`) — remaining km = great-circle from the courier's interpolated
  point to the destination (honest; only the courier's position is time-simulated, no GPS feed).
- **Tracking page:** added "Order placed" confirmation actions — **Back to home** + All orders buttons in the banner.
- **Transactions page** `/transactions` (`components/order/TransactionsView` + sidebar `Receipt` nav, i18n
  nav.transactions ×5 langs): KPI cards (total **spent** / **earned** / **net** / count), 6-month spent-vs-earned
  bar chart, filter tabs (All/Purchases/Sales), combined feed (purchase − / sale +, cancelled struck-through) →
  links to tracking. Uses `fetchMyOrders` + new `fetchSellerOrders`.
- **Seller ping** enriched: in-app notification lists items + linked channels; **Telegram** DM real (needs
  connected chat id). NOTE: Instagram/TikTok/WhatsApp DMs need their paid/business APIs + opt-in — can't be
  truly sent for free, so in-app + Telegram are the live channels (not faked).
- **Catalog page is a stub** — needs the 100+ filters UI + reads `?q=`/category filters that
  SearchBar & Oasis Helper already link to.
- **Categories/subcategories/tags** (electronics, phones, furniture, swords, cosplay…):
  real GET + brand-style select in Sell AND Catalog. `products.type` CHECK only allows
  perfume/watch/glasses → needs migration (`categories` table + `category`/`tags` cols).
- **Published products must show on home/catalog/search** (owner: "только локально?").
  `createProduct` writes to `products`, but home/catalog use `DEMO_PRODUCTS` + catalog is a
  stub. Wire a real products query into home rows, catalog grid, and SearchBar.
- **Promo status in left sidebar** ("АКТИВИРОВАН ПРОМОКОД: …" / "НЕ АКТИВИРОВАН") — needs a
  promo redux slice shared by cart + sidebar.
- **Admin panel CRUD** (brands/categories add-delete-edit, ban/unban users, see all
  signups) + **admin Oasis Helper variant** (smarter, reads logs, builds promos via NL).

## ✅ DONE — Phase 7: Messaging (buyer ↔ seller chat, realtime)
- **Home `LiveTracker`** rewritten: shows your active order on the real `RouteMap` (live km/ETA,
  courier, "open full tracking") or an empty state (was a stale stub — that's the "fake map" the owner saw).
- **DB** `0009_messaging.sql` (applied): `conversations` (canonical `user_a<user_b` pair, unique,
  `last_message/last_sender/last_at`) + `messages` (sender/recipient, text, `attachments[]`, `read`).
  Trigger `bump_conversation` refreshes preview; RLS = participants only; **both tables in `supabase_realtime`**.
- **Data** `lib/data/messages.ts`: `fetchConversations` (inbox + unread, embeds both profiles via
  `!conversations_user_a_fkey`), race-safe `getOrCreateConversation`, `fetchMessages`, `sendMessage`,
  `markRead`, `fetchPeerMini`.
- **`/messages`** (inbox) + **`/messages/[id]`** (chat) → `components/messages/MessagesView` master-detail
  (searchable thread list + active pane / splash, responsive; auto-refetch on realtime changes).
  `[id]` = the OTHER user's id (matches product "Message seller" → `/messages/{sellerId}`).
- **`ChatPane`**: realtime `chat:{convId}` (live messages dedup by id + **presence online dot**),
  read receipts (✓/✓✓ + auto-markRead), image attachments (`uploadMedia`), emoji picker, quick-reply
  chips, Enter-to-send, self-chat + unknown-peer guards.

## ✅ DONE — Phase 7.1: rich chat (voice · stickers · GIFs · audio/video calls)
- **Voice messages:** MediaRecorder → upload to `media` bucket → sent as an audio attachment,
  rendered with an inline `<audio controls>`. Record bar with timer + cancel/send.
- **Stickers:** big-emoji panel; emoji-only messages render large (no bubble) via `isEmojiOnly`.
- **GIFs:** `/api/gifs` proxies Giphy (`GIPHY_API_KEY` or public beta key) — trending + search;
  picker sends the gif url as an attachment (`.gif` → animated `<img>`).
- **Audio + video calls:** `hooks/useCall.ts` = WebRTC (public STUN, no TURN) with **signaling over
  the same Supabase realtime channel** (`broadcast` event `call`: offer/answer/ice/end). ICE buffered
  until remote desc set; `sessionId` re-keys the overlay per call. `components/messages/CallOverlay.tsx`
  = incoming ring (accept/decline), in-call screen (remote video / avatar for audio, local PiP),
  mute, camera toggle, hangup, duration timer. Call buttons added to the chat header.
- Product "Message seller": demo listings (no seller) now toast + open inbox instead of silently.

## ✅ DONE — Phase 8: Promo codes page + rich promo model
- **Promo model rebuilt** (`lib/promo-codes.ts`): `PromoDef` supports **percent / fixed сомонӣ /
  cashback**, scope (all/category/product) + `scopeLabel`, `minOrder`, `expiresAt`, `locked`+
  `lockProgress`/`lockHint`. Helpers `findPromo`, `toApplied`, `promoDiscount` (percent→%, fixed→
  сомонӣ off, cashback→0 upfront), `promoCashback`, `promoShort(money)` (currency-aware label).
- **Redux promo slice** now stores the full applied promo `{code,type,value,scope,scopeLabel}`
  (was `{code,discountPercent}`). Updated every consumer: `StoreSync` (restore), `PromoStatus`
  (sidebar, currency-aware label + locked guard), `CartView` (discount via `promoDiscount` +
  cashback line + "Valid on" scope), `CheckoutView`, **`/api/orders`** (server recompute via
  `findPromo`+`promoDiscount`, handles fixed). Fixed amounts are TJS-base → `useMoney` converts
  (50 смн shows as ~₽/$/etc per chosen currency).
- **`/promo` page** (`components/promo/PromoView`): loyalty-tier progress banner, Available/Locked
  tabs, **ticket-shaped coupon cards** (cut-out circles, big value, type chip, scope + min-order
  badges, expiry countdown, rainbow stub for ≥50% off), **Copy** (canvas-confetti + "Copied!"),
  **Apply/Remove** (sets the shared active promo → reflected in cart/sidebar), locked cards show a
  progress bar + unlock hint. Active promo banner at top.
- **Targeted promos (real, not "from thin air"):** each `PromoDef` has an `id` + scope by
  **brand / category / product** (`brands`/`categories`/`productIds`). `promoMatchesProduct` +
  `promoPercentForProduct`. When a percent promo is active, **matching products show the reduced
  price + badge across ProductCard (catalog, home, everywhere)** — e.g. TOMFORD20 makes every Tom
  Ford card show −20%. Cart/Checkout discount applies **only to matching selected lines**
  (`applicableSubtotal`), shows "No selected items match CODE" when none qualify. **Server
  `/api/orders` re-verifies scope** against real `products` rows (brand/type/category/tags) so a
  scoped discount can't be claimed on non-matching items. Demo brand promos: TOMFORD20, CREED15;
  category: WATCH15 (watches), SCENT25 (perfumes). Add-to-cart still stores list price (promo is a
  summary-level discount → no double counting).
- **Timed activation (per user):** each promo has `windowHours` (24h flash or 7d). `toApplied` stamps
  `activatedAt`+`expiresAt` (clamped to global cutoff); `AppliedPromo` + promo slice carry them.
  `PromoStatus` (always-mounted sidebar) ticks every 1s, shows a live **countdown**, and
  **auto-deactivates** when the window passes (toast). `StoreSync` drops an expired promo on load.
  Promo page shows "Xh/Xd after use" per card + "expires in …" on the active one.
- **One-promo-per-period lock:** activating commits the user to that code until its window ends.
  Promo slice gained `lockedCode`/`lockedUntil` (separate localStorage `oasis-promo-lock`).
  Shared `hooks/usePromo.ts` (`apply`/`deactivate`) enforces it everywhere (sidebar, cart input,
  promo-page input/cards): while locked, **other coupons grey out + disable**, the input rejects a
  different code, **deactivating keeps the lock** (discount stops but can't switch). Re-activating the
  same locked code reuses the original window (no extension). `PromoStatus` timer releases the lock
  (`clearPromoLock`) + active promo when the period passes. `StoreSync` restores a non-expired lock.
- **Manual code entry on the promo page** (`Have a code?` input) for codes not listed — plus
  `hidden` promos (INSTA25, TELEGRAM50) that never render as cards but activate when typed
  (the "shared on socials" case). All entry points share `usePromo.apply` (same lock + currency rules).

## ✅ DONE — Phase 9: YouTube-style endless home feed
- `components/home/InfiniteFeed.tsx`: filter chips (For you / categories / popular / deals / under-100)
  + an **infinite-scroll grid** (IntersectionObserver sentinel, BATCH 12, cap 144) that cycles a
  deterministic reshuffle of `useLiveProducts` so the page feels endless now (few/demo products) and
  naturally lengthens as real listings are published. `whileInView` reveal per card, "all caught up"
  footer at the cap. Mounted at the bottom of `HomeDashboard` (after the swiper rows).

## 🟡 IN PROGRESS — Phase 10: full client i18n (5 languages)
- Goal: translate the ENTIRE client (not admin) into en/ru/tg/kk/uz — every page, modal, input.
- Approach: expand `lib/i18n/dict.ts` (key → 5 langs) + wire `useT` page-by-page (keeps build green).
- **DONE so far:** shared chrome (nav/topbar/profile menu/promo status) + Settings (earlier) +
  **Cart** (`CartView`), **Favorites** (`FavoritesView`), **Promo page** (`PromoView`) — fully wired,
  incl. modals, inputs, toasts, summary, coupon cards (UI chrome). Added `common.*`, `cart.*`,
  `fav.*`, `promoPg.*` namespaces in all 5 languages.
- **REMAINING (next batches):** Home (greeting/stat tiles/browse/rows/infinite feed/live tracker),
  Product detail + reviews, Checkout, Orders/Tracking/Transactions, Messages/Chat, AI assistant +
  Oasis helper, Profile/Edit/Sell, Billing, Auth (login/register), Landing. Promo *content* strings
  (taglines, scopeLabels) + `promoWindowLabel` units still English (marketing copy — content pass).

## 🔜 EARLIER deferred (told the owner)
- **Admin brands/categories/subcategories CRUD** — needs a real migration (`brands`,
  `categories` w/ `parent_id`) + RLS (admin-only writes) + a data layer + admin pages
  (admin/products is still a stub). Brands are still the static `PRODUCT_BRANDS` list.
- **True AI image cover generation** — Gemini 1.5 flash is text-only; needs an image model.
- **Full WYSIWYG description** (color picker, real rich text) — currently markdown markers.
- Settings page is still a stub (theme/locale/currency/plan/notifications live elsewhere).

## 🔜 NEXT (older list) — recommended order
1. **Backend (rest, huge):** add later migrations for catalog/orders/messaging
   (`categories`, `products`, `product_variants`, `reviews`, `cart_items`, `favorites`,
   `orders`, `order_items`, `deliveries`, `couriers`, `notifications`, `conversations`,
   `messages`, `ai_messages`) + RLS + product/courier seed. Apply via `supabase/apply.mjs`.
   Generate DB types. (Identity tables already done — see Phase 1a.)
2. Global FX: `components/fx/ParticleField` (tsparticles, cursor-attract — see
   `AboutTheProject/fishka`), custom cursor, magnetic buttons, tilt cards.
3. Layout shells: navbar / collapsible sidebar / footer (brand icon), theme + locale toggles.
4. Wire `next-intl` (routing + request + middleware) for en/ru/tg.
5. Then pages by phase (see plan): Landing → Home → Catalog(100+ filters) → Product/[id]
   → Cart/Favorites → Checkout/Tracking(3D TJ map) → AI(Gemini) → Messages → Admin → Promo.

## Keys still needed from owner
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`.

## Design rule
Mockups in `AboutTheProject/Maket/` differ on purpose — merge into one "golden middle".
Use the icon from `AboutTheProject/Icon/`. Discount badges: bigger discount → more rainbow/bold.
