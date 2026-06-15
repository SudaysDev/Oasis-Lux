-- ============================================================================
-- OASIS LUX :: Phase 4 — Product reviews (the Product-by-ID page)
-- Reviews are keyed by a free-form product_id (text) so BOTH demo-seed products
-- ("p1", "w2", …) and real DB listings (uuid) can be reviewed with one table.
-- Helpfulness = a per-user like; verified_buyer flips true once the orders
-- system can confirm a purchase (defaults false until then).
-- ============================================================================

create table if not exists public.product_reviews (
  id             uuid primary key default gen_random_uuid(),
  product_id     text not null,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  rating         integer not null check (rating between 1 and 5),
  body           text not null default '',
  photos         text[] not null default '{}',
  verified_buyer boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (product_id, author_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews(product_id, created_at desc);

create table if not exists public.product_review_likes (
  review_id  uuid not null references public.product_reviews(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- ---------------------------------------------------------------------------
-- RLS — everyone reads; an author manages only their own review/like
-- ---------------------------------------------------------------------------
alter table public.product_reviews      enable row level security;
alter table public.product_review_likes enable row level security;

drop policy if exists previews_read on public.product_reviews;
create policy previews_read on public.product_reviews for select using (true);
drop policy if exists previews_insert on public.product_reviews;
create policy previews_insert on public.product_reviews for insert with check (auth.uid() = author_id);
drop policy if exists previews_update_own on public.product_reviews;
create policy previews_update_own on public.product_reviews for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists previews_delete_own on public.product_reviews;
create policy previews_delete_own on public.product_reviews for delete using (auth.uid() = author_id);

drop policy if exists plikes_read on public.product_review_likes;
create policy plikes_read on public.product_review_likes for select using (true);
drop policy if exists plikes_write on public.product_review_likes;
create policy plikes_write on public.product_review_likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
