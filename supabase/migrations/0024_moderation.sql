-- ============================================================================
-- OASIS LUX :: Phase 13 — moderation cases / violation history.
--   Every violation (inappropriate photo, profanity in description/username,
--   scam, spam…) is logged against a USER or a PRODUCT, together with the
--   punishment the auto-moderation engine handed down (warn / mute Nd / ban Nd
--   / product hidden / product deleted). Repeat offences escalate.
-- ============================================================================

create table if not exists public.violations (
  id           uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user', 'product')),
  subject_id   uuid not null,                       -- the user id OR product id in question
  user_id      uuid references public.profiles(id) on delete set null,  -- offender (product → its seller) for escalation
  category     text not null,                       -- photo · text · username · scam · spam · harassment · other
  severity     int  not null default 2 check (severity between 1 and 5),
  detail       text not null default '',
  evidence     text,                                -- url or quoted snippet
  action       text not null,                       -- machine: warn|mute_chat|mute_review|block_sell|ban|hide_product|delete_product
  action_label text not null,                       -- human: "Chat muted · 3d"
  action_until timestamptz,                         -- when the applied sanction lifts (null = permanent / instant)
  source       text not null default 'admin' check (source in ('admin', 'auto')),
  admin_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists violations_subject_idx on public.violations(subject_id, created_at desc);
create index if not exists violations_user_idx    on public.violations(user_id, created_at desc);

alter table public.violations enable row level security;
-- admins only (writes happen via the service-role moderation action, which bypasses RLS)
drop policy if exists violations_admin_read on public.violations;
create policy violations_admin_read on public.violations for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
