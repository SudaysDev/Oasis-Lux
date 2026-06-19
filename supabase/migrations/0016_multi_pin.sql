-- ============================================================================
-- OASIS LUX :: multiple pinned messages per conversation (Telegram-style)
--   • conversations.pinned_message_ids : ordered list of pinned message ids.
--     The single pinned_message_id (0015) is migrated into the array and kept
--     for back-compat but no longer written to.
-- ============================================================================
alter table public.conversations
  add column if not exists pinned_message_ids uuid[] not null default '{}';

update public.conversations
  set pinned_message_ids = array[pinned_message_id]
  where pinned_message_id is not null
    and (pinned_message_ids is null or pinned_message_ids = '{}');
