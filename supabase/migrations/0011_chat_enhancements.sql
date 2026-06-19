-- ============================================================================
-- OASIS LUX :: Phase 8 — modern messenger features
--   • reply_to            : quote / reply to an earlier message
--   • message_reactions    : emoji reactions (per user, realtime)
--   • blocks               : block list, enforced at the DB on message insert
--   • msg_delete policy     : senders can delete (unsend) their own messages
-- ============================================================================

-- --- replies ----------------------------------------------------------------
alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null;

-- --- reactions --------------------------------------------------------------
create table if not exists public.message_reactions (
  message_id      uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  emoji           text not null,
  created_at      timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists message_reactions_msg_idx  on public.message_reactions(message_id);
create index if not exists message_reactions_conv_idx on public.message_reactions(conversation_id);

-- --- blocks -----------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.message_reactions enable row level security;
alter table public.blocks            enable row level security;

-- reactions: any conversation participant can see them; you can only add /
-- remove your own (and only on a conversation you belong to).
drop policy if exists reaction_read on public.message_reactions;
create policy reaction_read on public.message_reactions for select
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())));
drop policy if exists reaction_insert on public.message_reactions;
create policy reaction_insert on public.message_reactions for insert
  with check (user_id = auth.uid()
              and exists (select 1 from public.conversations c
                          where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())));
drop policy if exists reaction_delete on public.message_reactions;
create policy reaction_delete on public.message_reactions for delete
  using (user_id = auth.uid());

-- blocks: you manage your own list; either party may read a row that names them.
drop policy if exists block_read on public.blocks;
create policy block_read on public.blocks for select
  using (blocker_id = auth.uid() or blocked_id = auth.uid());
drop policy if exists block_insert on public.blocks;
create policy block_insert on public.blocks for insert
  with check (blocker_id = auth.uid());
drop policy if exists block_delete on public.blocks;
create policy block_delete on public.blocks for delete
  using (blocker_id = auth.uid());

-- senders can unsend their own messages
drop policy if exists msg_delete on public.messages;
create policy msg_delete on public.messages for delete
  using (auth.uid() = sender_id);

-- enforce blocking at the DB: you cannot insert a message if either side has
-- blocked the other.
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = recipient_id and b.blocked_id = sender_id)
         or (b.blocker_id = sender_id and b.blocked_id = recipient_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$ begin alter publication supabase_realtime add table public.message_reactions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.blocks;            exception when others then null; end $$;
