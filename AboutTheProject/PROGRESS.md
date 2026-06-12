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

## 🔜 NEXT — still open (owner asked, needs DB / bigger work)
- **product/[id] FULL page** (still a stub): media gallery (1 big + 3 thumbs), full info,
  bottom recommendations (click → reload with that product), **two CTAs: Message seller /
  Order** (order auto-pings the seller's Telegram/Instagram for free), buyer order page
  (id, product, seller + reviews, ETA, REAL map of where it's headed), **cancel allowed
  only within first 15 min** then auto-locked.
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
