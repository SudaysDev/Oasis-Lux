-- ============================================================================
-- OASIS LUX :: Phase 1 schema — identity & promos
-- (Catalog / orders / messaging / deliveries tables land in later migrations.)
-- Applied to project onobgfvujbjrqavovgkm via supabase/apply.mjs.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles :: one row per auth user (mirrors types/index.ts Profile)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  full_name       text not null default '',
  avatar_url      text,
  banner_url      text,
  phone           text unique not null,
  role            text not null default 'customer'
                    check (role in ('customer','seller','admin','courier')),
  socials         jsonb not null default '{}'::jsonb,
  telegram_chat_id text,
  loyalty_tier    text not null default 'Bronze'
                    check (loyalty_tier in ('Bronze','Silver','Gold','Platinum')),
  loyalty_points  integer not null default 0,
  cashback_balance numeric(12,2) not null default 0,
  locale          text not null default 'ru' check (locale in ('en','ru','tg')),
  theme           text not null default 'dark' check (theme in ('dark','light')),
  bio             text,
  created_at      timestamptz not null default now()
);
create index if not exists profiles_phone_idx on public.profiles(phone);
create index if not exists profiles_role_idx  on public.profiles(role);

-- ---------------------------------------------------------------------------
-- phone_otps :: free dev OTP store (ready to swap delivery to Telegram/SMS)
-- ---------------------------------------------------------------------------
create table if not exists public.phone_otps (
  id          bigint generated always as identity primary key,
  phone       text not null,
  code        text not null,
  purpose     text not null default 'auth'
                check (purpose in ('auth','login','register')),
  expires_at  timestamptz not null,
  consumed    boolean not null default false,
  attempts    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists phone_otps_phone_idx on public.phone_otps(phone);

-- ---------------------------------------------------------------------------
-- promo_codes :: registration invite codes + /promo page (mirrors PromoCode)
-- ---------------------------------------------------------------------------
create table if not exists public.promo_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  type         text not null default 'percent'
                 check (type in ('percent','fixed','cashback')),
  value        numeric(12,2) not null default 0,
  scope        text not null default 'all'
                 check (scope in ('all','category','product')),
  scope_ref    text,
  scope_label  text,
  min_order    numeric(12,2),
  max_discount numeric(12,2),
  expires_at   timestamptz,
  usage_limit  integer,
  used_count   integer not null default 0,
  is_active    boolean not null default true,
  ai_generated boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists promo_codes_code_idx on public.promo_codes(lower(code));

-- ---------------------------------------------------------------------------
-- promo_redemptions :: who used which code (signup bonus, checkout, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.promo_redemptions (
  id         bigint generated always as identity primary key,
  promo_id   uuid not null references public.promo_codes(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  context    text not null default 'signup',
  created_at timestamptz not null default now(),
  unique (promo_id, user_id, context)
);
