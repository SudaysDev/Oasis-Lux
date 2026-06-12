-- ============================================================================
-- OASIS LUX :: Phase 2a — per-user cart & favorites (persisted, RLS-owned)
-- product_id is free text for now (demo catalog); becomes an FK when the
-- products table lands. Cart lines store a snapshot so they render without it.
-- ============================================================================

create table if not exists public.cart_items (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  product_id    text not null,
  variant_id    text not null default '',
  title         text not null,
  image         text not null default '',
  unit_price    numeric(12,2) not null default 0,
  variant_label text,
  quantity      integer not null default 1 check (quantity > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);
create index if not exists cart_items_user_idx on public.cart_items(user_id);

create table if not exists public.favorites (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists favorites_user_idx on public.favorites(user_id);

-- RLS: each user reads/writes only their own rows (the browser anon client uses
-- the user's session, so these mutations are safe to run client-side).
alter table public.cart_items enable row level security;
alter table public.favorites  enable row level security;

drop policy if exists cart_items_own on public.cart_items;
create policy cart_items_own on public.cart_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
