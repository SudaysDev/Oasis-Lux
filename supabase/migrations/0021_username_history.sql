-- ============================================================================
-- OASIS LUX :: username history — every nickname a user ever had, with dates.
--   A trigger captures any change to profiles.username (client edit OR admin
--   override) into an append-only log. Admins read all; a user reads their own.
-- ============================================================================

create table if not exists public.username_history (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  old_username text,
  new_username text not null,
  changed_at   timestamptz not null default now()
);
create index if not exists username_history_user_idx on public.username_history(user_id, changed_at desc);

create or replace function public.track_username_change() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.username is distinct from old.username then
    insert into public.username_history (user_id, old_username, new_username)
    values (new.id, old.username, new.username);
  end if;
  return new;
end $$;

drop trigger if exists trg_track_username on public.profiles;
create trigger trg_track_username after update of username on public.profiles
  for each row execute function public.track_username_change();

alter table public.username_history enable row level security;
drop policy if exists uname_hist_read on public.username_history;
create policy uname_hist_read on public.username_history for select
  using (user_id = auth.uid()
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
