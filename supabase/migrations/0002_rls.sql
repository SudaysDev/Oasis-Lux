-- ============================================================================
-- OASIS LUX :: Row Level Security — Phase 1
-- Server actions use the service-role key (bypasses RLS) for sign-up/login.
-- These policies govern what the browser (anon / authenticated) may read.
-- ============================================================================

alter table public.profiles          enable row level security;
alter table public.phone_otps         enable row level security; -- no policies => service-role only
alter table public.promo_codes        enable row level security;
alter table public.promo_redemptions  enable row level security;

-- profiles -------------------------------------------------------------------
-- Authenticated users may read profiles (needed for /profile/[id]); a public
-- DTO/view will narrow exposed columns in a later phase.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

-- promo_codes ----------------------------------------------------------------
-- Anyone may read active codes (so the /promo page & invite field work);
-- writes happen via service-role / admin only.
drop policy if exists promo_codes_read_active on public.promo_codes;
create policy promo_codes_read_active on public.promo_codes
  for select using (is_active = true);

-- promo_redemptions ----------------------------------------------------------
drop policy if exists promo_redemptions_read_own on public.promo_redemptions;
create policy promo_redemptions_read_own on public.promo_redemptions
  for select using (auth.uid() = user_id);
