-- ============================================================================
-- OASIS LUX :: pinned messages + service ("system") messages
--   • conversations.pinned_message_id : the message currently pinned in a chat
--     (null = none). SET NULL if that message is deleted.
--   • messages.kind : 'normal' (default) or 'service'. Service messages render
--     as centered chips in the timeline — e.g. "<name> pinned a message",
--     "<name> cleared the history" — exactly like Telegram's action messages.
-- ============================================================================
alter table public.conversations
  add column if not exists pinned_message_id uuid references public.messages(id) on delete set null;

alter table public.messages
  add column if not exists kind text not null default 'normal';
