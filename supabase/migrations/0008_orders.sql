-- ============================================================================
-- OASIS LUX :: Phase 6 — Orders & checkout
-- An order is created on payment. Real product stock is decremented ONLY after
-- the 15-min cancel window closes (see `stock_settled` + /api/orders/settle).
-- ============================================================================

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  seller_id       uuid references public.profiles(id) on delete set null,
  status          text not null default 'placed'
                    check (status in ('placed','processing','out_for_delivery','arrived','fulfilled','cancelled')),
  subtotal        numeric(12,2) not null default 0,
  discount        numeric(12,2) not null default 0,
  delivery_fee    numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  currency        text not null default 'TJS',
  promo_code      text,
  region          text not null default 'Dushanbe',
  address         text not null default '',
  full_name       text not null default '',
  phone           text not null default '',
  card_last4      text,
  card_brand      text,
  courier_name    text not null default '',
  courier_phone   text not null default '',
  courier_vehicle text not null default '',
  distance_km     numeric(6,1) not null default 0,
  eta_min         integer not null default 0,
  origin          jsonb not null default '{}'::jsonb,
  destination     jsonb not null default '{}'::jsonb,
  paid_at         timestamptz,
  cancel_deadline timestamptz,
  cancelled_at    timestamptz,
  stock_settled   boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_seller_idx on public.orders(seller_id);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    text not null,
  title         text not null,
  image         text not null default '',
  variant_label text,
  quantity      integer not null default 1,
  unit_price    numeric(12,2) not null default 0
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------------
-- RLS — buyer & seller can read; buyer writes/cancels their own
-- ---------------------------------------------------------------------------
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select
  using (auth.uid() = user_id or auth.uid() = seller_id);
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders for insert with check (auth.uid() = user_id);
drop policy if exists orders_update_own on public.orders;
create policy orders_update_own on public.orders for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists oitems_read on public.order_items;
create policy oitems_read on public.order_items for select
  using (exists (select 1 from public.orders o
                 where o.id = order_id and (o.user_id = auth.uid() or o.seller_id = auth.uid())));
drop policy if exists oitems_insert on public.order_items;
create policy oitems_insert on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
