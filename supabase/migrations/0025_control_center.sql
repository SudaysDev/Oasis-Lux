-- ============================================================================
-- OASIS LUX :: Phase 12 — Full Control command center
--   • purchase_blocks : scoped buying bans ("/set_zapret @user for brand:Dior")
--       enforced at the DB so a blocked user physically can't buy that
--       brand / category / color / tag (RLS on order_items insert).
--   • profiles.is_boosted : seller-level promotion (surfaces more in algorithms,
--       sibling of products.sanctions.featured).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Scoped purchase blocks
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  scope_type  text not null check (scope_type in ('brand','category','color','tag')),
  scope_value text not null,
  reason      text,
  until       timestamptz,                       -- null = permanent
  created_at  timestamptz not null default now(),
  unique (user_id, scope_type, scope_value)
);
create index if not exists purchase_blocks_user_idx on public.purchase_blocks(user_id);

alter table public.purchase_blocks enable row level security;
-- a user may read their own blocks (storefront can warn before checkout);
-- all writes happen through the service role from the control center.
drop policy if exists pblocks_read_own on public.purchase_blocks;
create policy pblocks_read_own on public.purchase_blocks for select using (auth.uid() = user_id);

-- True when `uid` is currently blocked from buying product `pid`.
create or replace function public.purchase_blocked(uid uuid, pid text)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.purchase_blocks b
    join public.products p on p.id::text = pid
    where b.user_id = uid
      and (b.until is null or b.until > now())
      and (
        (b.scope_type = 'brand'    and lower(p.brand)                = lower(b.scope_value)) or
        (b.scope_type = 'category' and lower(coalesce(p.category,'')) = lower(b.scope_value)) or
        (b.scope_type = 'color'    and lower(coalesce(p.color,''))    = lower(b.scope_value)) or
        (b.scope_type = 'tag'      and exists (select 1 from unnest(p.tags) t where lower(t) = lower(b.scope_value)))
      )
  );
$$;

-- Re-create the order_items insert policy with the scoped-block guard bolted on.
drop policy if exists oitems_insert on public.order_items;
create policy oitems_insert on public.order_items for insert
  with check (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    and not public.purchase_blocked(auth.uid(), product_id)
  );

-- ---------------------------------------------------------------------------
-- Seller-level promotion (boost)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists is_boosted boolean not null default false;
