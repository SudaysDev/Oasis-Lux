-- ============================================================================
-- OASIS LUX :: forwarded-message attribution
--   • forwarded_from : original author of a forwarded message (null = not a
--     forward). Lets the receiving chat show "Forwarded from <name>" and open
--     that user's mini profile. SET NULL if the author's profile is removed.
-- ============================================================================
alter table public.messages
  add column if not exists forwarded_from uuid references public.profiles(id) on delete set null;
