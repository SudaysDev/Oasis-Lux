-- ============================================================================
-- OASIS LUX :: Phase 12 — EVERY sanction can now be timed (auto-expiring).
--   Instead of a boolean per restriction we store a JSONB map:
--       value 'perm'              → permanent
--       value '2026-07-01T..Z'    → active until that instant, then auto-lifts
--   profiles.restrictions  : chat·sell·buy·review·report·favorite·cart (+ future)
--   products.sanctions     : hidden·frozen·no_reviews·no_orders·featured
--   One shared expiry-aware checker `sanc_active(jsonb,text)` powers both, so
--   adding a brand-new sanction kind later needs ZERO schema changes.
-- ============================================================================

-- ---- new jsonb maps --------------------------------------------------------
alter table public.profiles add column if not exists restrictions jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists sanctions    jsonb not null default '{}'::jsonb;

-- ---- migrate existing boolean flags into the maps (all as 'perm') ----------
update public.profiles set restrictions = (
  '{}'::jsonb
  || case when restrict_chat     then jsonb_build_object('chat','perm')     else '{}'::jsonb end
  || case when restrict_sell     then jsonb_build_object('sell','perm')     else '{}'::jsonb end
  || case when restrict_buy      then jsonb_build_object('buy','perm')      else '{}'::jsonb end
  || case when restrict_review   then jsonb_build_object('review','perm')   else '{}'::jsonb end
  || case when restrict_report   then jsonb_build_object('report','perm')   else '{}'::jsonb end
  || case when restrict_favorite then jsonb_build_object('favorite','perm') else '{}'::jsonb end
  || case when restrict_cart     then jsonb_build_object('cart','perm')     else '{}'::jsonb end
) where restrict_chat or restrict_sell or restrict_buy or restrict_review or restrict_report or restrict_favorite or restrict_cart;

update public.products set sanctions = (
  '{}'::jsonb
  || case when hidden     then jsonb_build_object('hidden','perm')     else '{}'::jsonb end
  || case when frozen     then jsonb_build_object('frozen','perm')     else '{}'::jsonb end
  || case when no_reviews then jsonb_build_object('no_reviews','perm') else '{}'::jsonb end
  || case when no_orders  then jsonb_build_object('no_orders','perm')  else '{}'::jsonb end
  || case when featured   then jsonb_build_object('featured','perm')   else '{}'::jsonb end
) where hidden or frozen or no_reviews or no_orders or featured;

-- ---- shared expiry-aware checker ------------------------------------------
create or replace function public.sanc_active(s jsonb, kind text) returns boolean
  language sql stable as $$
  select case when s ? kind then
    (s->>kind = 'perm') or ((s->>kind) ~ '^\d{4}' and (s->>kind)::timestamptz > now())
  else false end
$$;

create or replace function public.acct_restricted(uid uuid, kind text) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select (is_banned or (ban_until is not null and ban_until > now())) or public.sanc_active(restrictions, kind)
    from public.profiles where id = uid
  ), false)
$$;

-- ===========================================================================
-- Re-point the product RLS at the expiry-aware sanctions map
-- ===========================================================================
drop policy if exists products_read on public.products;
create policy products_read on public.products for select
  using ((is_active = true and not public.sanc_active(sanctions, 'hidden')) or auth.uid() = seller_id);

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products for update
  using (auth.uid() = seller_id and not public.sanc_active(sanctions, 'frozen'))
  with check (auth.uid() = seller_id and not public.acct_restricted(auth.uid(), 'sell'));

drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products for delete
  using (auth.uid() = seller_id and not public.sanc_active(sanctions, 'frozen'));

drop policy if exists previews_insert on public.product_reviews;
create policy previews_insert on public.product_reviews for insert
  with check (auth.uid() = author_id
              and not public.acct_restricted(auth.uid(), 'review')
              and not exists (select 1 from public.products p where p.id::text = product_id and public.sanc_active(p.sanctions, 'no_reviews')));

drop policy if exists oitems_insert on public.order_items;
create policy oitems_insert on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
              and not exists (select 1 from public.products p where p.id::text = product_id and public.sanc_active(p.sanctions, 'no_orders')));

-- ---- drop the now-unused boolean columns ----------------------------------
alter table public.profiles
  drop column if exists restrict_chat,  drop column if exists restrict_sell, drop column if exists restrict_buy,
  drop column if exists restrict_review, drop column if exists restrict_report,
  drop column if exists restrict_favorite, drop column if exists restrict_cart;
alter table public.products
  drop column if exists hidden, drop column if exists frozen,
  drop column if exists no_reviews, drop column if exists no_orders, drop column if exists featured;
