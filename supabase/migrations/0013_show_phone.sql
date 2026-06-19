-- Privacy: let a user choose whether their phone number is shown on their
-- public profile / chat profile card. Default off (private).
alter table public.profiles add column if not exists show_phone boolean not null default false;
