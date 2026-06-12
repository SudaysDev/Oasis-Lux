-- ============================================================================
-- OASIS LUX :: Phase 2b — social profile (LinkedIn-style)
-- products (seller listings) · user reviews + likes + replies · notifications
-- profile plan/verified · Storage bucket for avatars & banners.
-- ============================================================================

-- profiles: plan badge + verified tick -------------------------------------
alter table public.profiles add column if not exists plan text not null default 'free'
  check (plan in ('free', 'pro', 'elite'));
alter table public.profiles add column if not exists is_verified boolean not null default false;

-- products :: a seller's own listings ("User Sells") -----------------------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  brand       text not null default '',
  type        text not null default 'perfume' check (type in ('perfume', 'watch', 'glasses')),
  description text not null default '',
  color       text,
  condition   text not null default 'new' check (condition in ('new', 'like_new', 'used')),
  price       numeric(12,2) not null default 0,
  currency    text not null default 'TJS',
  stock       integer not null default 1,
  hue         integer not null default 200,
  images      text[] not null default '{}',
  rating      numeric(3,2) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists products_seller_idx on public.products(seller_id);

-- user_reviews :: a review *about a profile* (seller reputation) ------------
create table if not exists public.user_reviews (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  body       text not null default '',
  created_at timestamptz not null default now(),
  unique (subject_id, author_id)
);
create index if not exists user_reviews_subject_idx on public.user_reviews(subject_id);

create table if not exists public.user_review_likes (
  review_id  uuid not null references public.user_reviews(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create table if not exists public.user_review_replies (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.user_reviews(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists review_replies_review_idx on public.user_review_replies(review_id);

-- notifications -------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null default 'system'
               check (type in ('order', 'ai', 'system', 'promo', 'message', 'review')),
  title      text not null,
  body       text not null default '',
  data       jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.products             enable row level security;
alter table public.user_reviews         enable row level security;
alter table public.user_review_likes    enable row level security;
alter table public.user_review_replies  enable row level security;
alter table public.notifications        enable row level security;

drop policy if exists products_read on public.products;
create policy products_read on public.products for select
  using (is_active = true or auth.uid() = seller_id);
drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products for insert with check (auth.uid() = seller_id);
drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products for update
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products for delete using (auth.uid() = seller_id);

drop policy if exists ureviews_read on public.user_reviews;
create policy ureviews_read on public.user_reviews for select using (true);
drop policy if exists ureviews_insert on public.user_reviews;
create policy ureviews_insert on public.user_reviews for insert
  with check (auth.uid() = author_id and author_id <> subject_id);
drop policy if exists ureviews_update_own on public.user_reviews;
create policy ureviews_update_own on public.user_reviews for update
  using (auth.uid() = author_id) with check (auth.uid() = author_id);
drop policy if exists ureviews_delete_own on public.user_reviews;
create policy ureviews_delete_own on public.user_reviews for delete using (auth.uid() = author_id);

drop policy if exists ulikes_read on public.user_review_likes;
create policy ulikes_read on public.user_review_likes for select using (true);
drop policy if exists ulikes_write on public.user_review_likes;
create policy ulikes_write on public.user_review_likes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ureplies_read on public.user_review_replies;
create policy ureplies_read on public.user_review_replies for select using (true);
drop policy if exists ureplies_insert on public.user_review_replies;
create policy ureplies_insert on public.user_review_replies for insert with check (auth.uid() = author_id);
drop policy if exists ureplies_delete_own on public.user_review_replies;
create policy ureplies_delete_own on public.user_review_replies for delete using (auth.uid() = author_id);

drop policy if exists notif_read_own on public.notifications;
create policy notif_read_own on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket for avatars & banners
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

drop policy if exists media_read on storage.objects;
create policy media_read on storage.objects for select using (bucket_id = 'media');
drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects for insert
  with check (bucket_id = 'media' and auth.role() = 'authenticated');
drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects for update
  using (bucket_id = 'media' and auth.role() = 'authenticated');
drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects for delete
  using (bucket_id = 'media' and auth.role() = 'authenticated');
