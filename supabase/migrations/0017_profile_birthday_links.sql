-- ============================================================================
-- OASIS LUX :: profile birthday + custom links (Telegram/Instagram-style)
--   • birthday : optional date of birth (shown on the profile + chat card).
--   • links    : ordered list of {label, url} — website, GitHub, anything.
-- ============================================================================
alter table public.profiles
  add column if not exists birthday date,
  add column if not exists links jsonb not null default '[]'::jsonb;
