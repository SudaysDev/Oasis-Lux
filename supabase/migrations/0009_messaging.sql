-- ============================================================================
-- OASIS LUX :: Phase 7 — Direct messaging (buyer ↔ seller chat)
-- 1-on-1 conversations keyed by the canonical (user_a < user_b) pair, plus a
-- messages stream with read receipts + image attachments. Realtime-enabled so
-- new messages and presence (online dot) arrive live.
-- ============================================================================

create table if not exists public.conversations (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  product_id   text,
  last_message text not null default '',
  last_sender  uuid,
  last_at      timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists conversations_a_idx on public.conversations(user_a, last_at desc);
create index if not exists conversations_b_idx on public.conversations(user_b, last_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  text            text not null default '',
  attachments     text[] not null default '{}',
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Keep the conversation's last-message preview fresh on each new message
-- ---------------------------------------------------------------------------
create or replace function public.bump_conversation() returns trigger
  language plpgsql security definer as $$
begin
  update public.conversations
     set last_message = case when length(new.text) > 0 then new.text else '📎 Attachment' end,
         last_sender  = new.sender_id,
         last_at      = new.created_at
   where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists messages_bump on public.messages;
create trigger messages_bump after insert on public.messages
  for each row execute function public.bump_conversation();

-- ---------------------------------------------------------------------------
-- RLS — only the two participants can see / write
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists conv_read on public.conversations;
create policy conv_read on public.conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists conv_insert on public.conversations;
create policy conv_insert on public.conversations for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists conv_update on public.conversations;
create policy conv_update on public.conversations for update
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists msg_read on public.messages;
create policy msg_read on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (auth.uid() = sender_id);
drop policy if exists msg_update_recipient on public.messages;
create policy msg_update_recipient on public.messages for update
  using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------
-- Realtime: stream message inserts/updates to the participants
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when others then null; end $$;
