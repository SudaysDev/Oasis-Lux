-- ============================================================================
-- OASIS LUX :: Phase 10 — real admin power (moderation)
--   • Ban / restrict columns on profiles (was: admin could only LOOK).
--   • Restrictions are enforced at the DATABASE via RLS, so a banned or
--     restricted user is blocked everywhere the app inserts on their behalf
--     (chat, listings, checkout) — no per-call-site wiring needed.
--   • admin_note : private internal memo only admins ever read.
-- ============================================================================

alter table public.profiles
  add column if not exists is_banned     boolean not null default false,
  add column if not exists banned_at     timestamptz,
  add column if not exists ban_reason    text,
  add column if not exists restrict_chat boolean not null default false,
  add column if not exists restrict_sell boolean not null default false,
  add column if not exists restrict_buy  boolean not null default false,
  add column if not exists admin_note    text;

create index if not exists profiles_banned_idx on public.profiles(is_banned) where is_banned;

-- ---------------------------------------------------------------------------
-- Enforcement helper. SECURITY DEFINER so the RLS check can read the actor's
-- own moderation flags regardless of the caller's row-level visibility.
--   kind: 'chat' | 'sell' | 'buy' | anything-else (= plain ban check)
-- ---------------------------------------------------------------------------
create or replace function public.acct_restricted(uid uuid, kind text)
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case kind
      when 'chat' then is_banned or restrict_chat
      when 'sell' then is_banned or restrict_sell
      when 'buy'  then is_banned or restrict_buy
      else is_banned
    end
    from public.profiles where id = uid
  ), false)
$$;

-- ---------------------------------------------------------------------------
-- Tighten the INSERT policies so sanctions actually bite.
-- (Each is a faithful copy of the original + the restriction guard.)
-- ---------------------------------------------------------------------------

-- chat: banned / chat-restricted users can no longer send messages
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (auth.uid() = sender_id and not public.acct_restricted(auth.uid(), 'chat'));

-- selling: banned / sell-restricted users can no longer publish listings
drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products for insert
  with check (auth.uid() = seller_id and not public.acct_restricted(auth.uid(), 'sell'));

-- buying: banned / buy-restricted users can no longer place orders
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders for insert
  with check (auth.uid() = user_id and not public.acct_restricted(auth.uid(), 'buy'));
