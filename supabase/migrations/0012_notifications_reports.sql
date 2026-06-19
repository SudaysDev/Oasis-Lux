-- ============================================================================
-- OASIS LUX :: Phase 9 — real notifications for every social action + reports
--   • DB triggers auto-create notifications (they run SECURITY DEFINER, so they
--     bypass the locked-down notifications INSERT — clients still can't forge
--     notifications for other users).
--   • reports: a user can report another (with category + description); admins
--     read them and get notified.
--   • conversations: "delete for me" (clear timestamps) + "delete for everyone".
-- ============================================================================

-- helper: a human label for a profile (full name, else @username) ------------
create or replace function public.display_name(uid uuid) returns text
  language sql stable as $$
  select coalesce(nullif(full_name, ''), '@' || username) from public.profiles where id = uid
$$;

-- ---------------------------------------------------------------------------
-- Notification triggers
-- ---------------------------------------------------------------------------

-- someone reviewed / rated you
create or replace function public.notify_review() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.author_id <> new.subject_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.subject_id, 'review', 'New review',
            display_name(new.author_id) || ' rated you ' || new.rating || '★',
            jsonb_build_object('reviewId', new.id, 'fromId', new.author_id));
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_review on public.user_reviews;
create trigger trg_notify_review after insert on public.user_reviews
  for each row execute function public.notify_review();

-- someone liked your review
create or replace function public.notify_review_like() returns trigger
  language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.user_reviews where id = new.review_id;
  if author is not null and author <> new.user_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (author, 'review', 'Your review got a like',
            display_name(new.user_id) || ' liked your review',
            jsonb_build_object('reviewId', new.review_id, 'fromId', new.user_id));
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_review_like on public.user_review_likes;
create trigger trg_notify_review_like after insert on public.user_review_likes
  for each row execute function public.notify_review_like();

-- someone replied to your review
create or replace function public.notify_review_reply() returns trigger
  language plpgsql security definer set search_path = public as $$
declare author uuid;
begin
  select author_id into author from public.user_reviews where id = new.review_id;
  if author is not null and author <> new.author_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (author, 'review', 'New reply to your review',
            display_name(new.author_id) || ' replied to your review',
            jsonb_build_object('reviewId', new.review_id, 'fromId', new.author_id));
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_review_reply on public.user_review_replies;
create trigger trg_notify_review_reply after insert on public.user_review_replies
  for each row execute function public.notify_review_reply();

-- someone reviewed your product listing (only real DB products have a seller)
create or replace function public.notify_product_review() returns trigger
  language plpgsql security definer set search_path = public as $$
declare seller uuid; ptitle text;
begin
  select seller_id, title into seller, ptitle from public.products
    where id::text = new.product_id;
  if seller is not null and seller <> new.author_id then
    insert into public.notifications (user_id, type, title, body, data)
    values (seller, 'review', 'New product review',
            display_name(new.author_id) || ' reviewed ' || coalesce(ptitle, 'your product') || ' (' || new.rating || '★)',
            jsonb_build_object('productId', new.product_id, 'fromId', new.author_id));
  end if;
  return new;
end $$;
drop trigger if exists trg_notify_product_review on public.product_reviews;
create trigger trg_notify_product_review after insert on public.product_reviews
  for each row execute function public.notify_product_review();

-- new direct message (coalesced: one unread entry per conversation, newest)
create or replace function public.notify_message() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
    where user_id = new.recipient_id and type = 'message' and read = false
      and data->>'conversationId' = new.conversation_id::text;
  insert into public.notifications (user_id, type, title, body, data)
  values (new.recipient_id, 'message',
          'Message from ' || display_name(new.sender_id),
          case when length(new.text) > 0 then left(new.text, 90) else '📎 Attachment' end,
          jsonb_build_object('conversationId', new.conversation_id, 'fromId', new.sender_id));
  return new;
end $$;
drop trigger if exists trg_notify_message on public.messages;
create trigger trg_notify_message after insert on public.messages
  for each row execute function public.notify_message();

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid not null references public.profiles(id) on delete cascade,
  reported_id     uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  category        text not null,
  description     text not null default '',
  status          text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at      timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports(status, created_at desc);

alter table public.reports enable row level security;

-- a signed-in user files reports as themselves
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert
  with check (auth.uid() = reporter_id);
-- the reporter sees their own; admins see everything
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select
  using (auth.uid() = reporter_id
         or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
-- only admins move a report along
drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- notify every admin when a new report lands
create or replace function public.notify_report() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, type, title, body, data)
  select p.id, 'system', 'New report filed',
         display_name(new.reporter_id) || ' reported ' || display_name(new.reported_id) || ' · ' || new.category,
         jsonb_build_object('reportId', new.id, 'category', new.category)
    from public.profiles p where p.role = 'admin';
  return new;
end $$;
drop trigger if exists trg_notify_report on public.reports;
create trigger trg_notify_report after insert on public.reports
  for each row execute function public.notify_report();

-- ---------------------------------------------------------------------------
-- Conversation deletion: "for me" (clear) + "for everyone" (delete)
-- ---------------------------------------------------------------------------
alter table public.conversations add column if not exists a_cleared_at timestamptz;
alter table public.conversations add column if not exists b_cleared_at timestamptz;

drop policy if exists conv_delete on public.conversations;
create policy conv_delete on public.conversations for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.notifications; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.reports;       exception when others then null; end $$;
