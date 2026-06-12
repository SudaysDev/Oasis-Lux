-- ============================================================================
-- OASIS LUX :: seed data — Phase 1 (demo promo codes for the invite field)
-- More seed (perfume/watch/glasses products, couriers) lands with the catalog.
-- ============================================================================

insert into public.promo_codes
  (code, type, value, scope, scope_label, min_order, max_discount, is_active, ai_generated)
values
  ('WELCOME10',  'percent',  10, 'all',      'Everything', 0,    null, true,  false),
  ('OASIS20',    'percent',  20, 'all',      'Everything', 200,  100,  true,  false),
  ('CASHBACK15', 'cashback', 15, 'all',      'Everything', 0,    null, true,  false),
  ('WATCH50',    'percent',  50, 'category', 'Watches',    300,  200,  true,  false),
  ('VIP90',      'percent',  90, 'all',      'Everything', 1000, 500,  true,  true)
on conflict (code) do nothing;
