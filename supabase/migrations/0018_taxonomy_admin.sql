-- ============================================================================
-- OASIS LUX :: Phase — admin-managed taxonomy (brands · colors · tags)
-- Categories already exist (0006). This adds the remaining admin-controlled
-- vocabularies so the admin "Taxonomy" page has real create/edit/delete.
-- Applied via: node supabase/apply.mjs migrations/0018_taxonomy_admin.sql
-- ============================================================================

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists brands_name_key on public.brands (lower(name));

create table if not exists public.colors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  hex        text not null default '#888888',
  created_at timestamptz not null default now()
);
create unique index if not exists colors_name_key on public.colors (lower(name));

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists tags_name_key on public.tags (lower(name));

-- RLS: everyone reads the vocabularies; only admins manage them ---------------
alter table public.brands enable row level security;
alter table public.colors enable row level security;
alter table public.tags   enable row level security;

drop policy if exists brands_read on public.brands;
create policy brands_read on public.brands for select using (true);
drop policy if exists brands_admin on public.brands;
create policy brands_admin on public.brands for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists colors_read on public.colors;
create policy colors_read on public.colors for select using (true);
drop policy if exists colors_admin on public.colors;
create policy colors_admin on public.colors for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags for select using (true);
drop policy if exists tags_admin on public.tags;
create policy tags_admin on public.tags for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- seed a few starter colors so the swatch grid isn't empty --------------------
insert into public.colors (name, hex) values
  ('Black','#111111'), ('White','#f5f5f5'), ('Silver','#c0c0c0'), ('Gold','#d4af37'),
  ('Red','#e11d48'), ('Blue','#2563eb'), ('Green','#22c55e'), ('Cyan','#22d3ee'),
  ('Purple','#a855f7'), ('Pink','#ec4899'), ('Amber','#f59e0b'), ('Brown','#92400e')
on conflict do nothing;
