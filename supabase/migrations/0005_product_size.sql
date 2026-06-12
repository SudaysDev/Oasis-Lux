-- Phase 2c — optional size attribute for listings (shoes, apparel, watch case, etc.)
alter table public.products add column if not exists size text;
