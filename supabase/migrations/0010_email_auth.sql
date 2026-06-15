-- ============================================================================
-- OASIS LUX :: Phase 10 — email becomes the login identity
-- Free OTP is now delivered by EMAIL (Resend) instead of paid SMS to a phone.
-- Phone stays as an optional contact detail (used for delivery), not identity.
-- Applied via:  node supabase/apply.mjs migrations/0010_email_auth.sql
-- ============================================================================

-- profiles: add real email; phone is no longer the required identity ---------
alter table public.profiles add column if not exists email text;
-- case-insensitive uniqueness, but only when an email is present (legacy
-- phone-only rows keep email NULL without colliding)
create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email)) where email is not null;
create index if not exists profiles_email_idx on public.profiles(email);

alter table public.profiles alter column phone drop not null;

-- otp store: codes are now addressed to an email -----------------------------
alter table public.phone_otps add column if not exists email text;
alter table public.phone_otps alter column phone drop not null;
create index if not exists phone_otps_email_idx on public.phone_otps(email);
