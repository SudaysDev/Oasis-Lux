-- ============================================================================
-- OASIS LUX :: Phase 11 — a whole arsenal of sanctions (Minecraft-grade).
--   USERS  : timed bans + granular restrictions (review/report/favorite/cart)
--   PRODUCTS: hidden (shadow-hide) · frozen (lock seller edits) · no_reviews ·
--             no_orders · featured (positive control)
--   Everything is enforced at the DB via RLS so it bites everywhere.
-- ============================================================================

-- ---- USERS: new sanction columns -----------------------------------------
alter table public.profiles
  add column if not exists ban_until        timestamptz,                       -- timed ban (auto-expires)
  add column if not exists restrict_review   boolean not null default false,    -- can't post reviews
  add column if not exists restrict_report   boolean not null default false,    -- can't file reports
  add column if not exists restrict_favorite boolean not null default false,    -- can't favorite
  add column if not exists restrict_cart     boolean not null default false;    -- can't add to cart

-- ---- PRODUCTS: new sanction columns --------------------------------------
alter table public.products
  add column if not exists hidden     boolean not null default false,  -- shadow-hidden from storefront (≠ seller's is_active)
  add column if not exists frozen     boolean not null default false,  -- seller can't edit/delete
  add column if not exists no_reviews boolean not null default false,  -- reviews blocked
  add column if not exists no_orders  boolean not null default false,  -- ordering blocked
  add column if not exists featured   boolean not null default false;  -- pinned / featured
create index if not exists products_hidden_idx on public.products(hidden) where hidden;

-- ---- enforcement helper (now covers timed bans + all new kinds) -----------
create or replace function public.acct_restricted(uid uuid, kind text)
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select (is_banned or (ban_until is not null and ban_until > now())) or case kind
      when 'chat'     then restrict_chat
      when 'sell'     then restrict_sell
      when 'buy'      then restrict_buy
      when 'review'   then restrict_review
      when 'report'   then restrict_report
      when 'favorite' then restrict_favorite
      when 'cart'     then restrict_cart
      else false
    end
    from public.profiles where id = uid
  ), false)
$$;

-- ===========================================================================
-- RLS — wire the new sanctions into every relevant INSERT/UPDATE
-- ===========================================================================

-- user reviews ---------------------------------------------------------------
drop policy if exists ureviews_insert on public.user_reviews;
create policy ureviews_insert on public.user_reviews for insert
  with check (auth.uid() = author_id and author_id <> subject_id
              and not public.acct_restricted(auth.uid(), 'review'));

-- product reviews (also respects a product's own no_reviews flag) ------------
drop policy if exists previews_insert on public.product_reviews;
create policy previews_insert on public.product_reviews for insert
  with check (auth.uid() = author_id
              and not public.acct_restricted(auth.uid(), 'review')
              and not exists (select 1 from public.products p where p.id::text = product_id and p.no_reviews));

-- reports --------------------------------------------------------------------
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (auth.uid() = reporter_id and not public.acct_restricted(auth.uid(), 'report'));

-- favorites: split the old `for all` so we can gate INSERT only --------------
drop policy if exists favorites_own on public.favorites;
drop policy if exists favorites_read on public.favorites;
drop policy if exists favorites_insert on public.favorites;
drop policy if exists favorites_update on public.favorites;
drop policy if exists favorites_delete on public.favorites;
create policy favorites_read   on public.favorites for select using (auth.uid() = user_id);
create policy favorites_insert on public.favorites for insert with check (auth.uid() = user_id and not public.acct_restricted(auth.uid(), 'favorite'));
create policy favorites_update on public.favorites for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy favorites_delete on public.favorites for delete using (auth.uid() = user_id);

-- cart: same split -----------------------------------------------------------
drop policy if exists cart_items_own on public.cart_items;
drop policy if exists cart_read on public.cart_items;
drop policy if exists cart_insert on public.cart_items;
drop policy if exists cart_update on public.cart_items;
drop policy if exists cart_delete on public.cart_items;
create policy cart_read   on public.cart_items for select using (auth.uid() = user_id);
create policy cart_insert on public.cart_items for insert with check (auth.uid() = user_id and not public.acct_restricted(auth.uid(), 'cart'));
create policy cart_update on public.cart_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cart_delete on public.cart_items for delete using (auth.uid() = user_id);

-- order items: block ordering a product flagged no_orders -------------------
drop policy if exists oitems_insert on public.order_items;
create policy oitems_insert on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
              and not exists (select 1 from public.products p where p.id::text = product_id and p.no_orders));

-- products: a frozen listing can't be edited or deleted by its seller -------
drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products for update
  using (auth.uid() = seller_id and not frozen)
  with check (auth.uid() = seller_id and not public.acct_restricted(auth.uid(), 'sell'));
drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products for delete
  using (auth.uid() = seller_id and not frozen);

-- products: hide shadow-hidden listings from the public read too ------------
drop policy if exists products_read on public.products;
create policy products_read on public.products for select
  using ((is_active = true and hidden = false) or auth.uid() = seller_id);
