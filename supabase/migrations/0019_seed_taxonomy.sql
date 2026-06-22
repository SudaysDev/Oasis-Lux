-- ============================================================================
-- OASIS LUX :: seed the admin taxonomy tables from the previously-hardcoded
-- vocab (lib/sell-data.ts) + whatever sellers already used on real products.
-- This makes the DB the SINGLE SOURCE so admin edits propagate site-wide.
-- Applied via: node supabase/apply.mjs migrations/0019_seed_taxonomy.sql
-- ============================================================================

-- brands (the old PRODUCT_BRANDS list) --------------------------------------
insert into public.brands (name) values
  ('Tom Ford'),('Dior'),('Chanel'),('Creed'),('Xerjoff'),('Maison Margiela'),('Versace'),
  ('Giorgio Armani'),('Yves Saint Laurent'),('Parfums de Marly'),('Initio'),('Amouage'),
  ('Byredo'),('Le Labo'),('Lattafa'),('Tiziana Terenzi'),('Kilian'),('Mancera'),
  ('Rolex'),('Omega'),('Patek Philippe'),('Audemars Piguet'),('Cartier'),('Casio'),
  ('Seiko'),('Citizen'),('Tissot'),('TAG Heuer'),('Hublot'),('G-Shock'),
  ('Ray-Ban'),('Oakley'),('Persol'),('Carrera'),('Police'),('Gucci'),('Prada'),('Montblanc')
on conflict do nothing;

-- + any brand a real seller already typed on a product
insert into public.brands (name)
  select distinct trim(brand) from public.products
  where coalesce(trim(brand), '') <> ''
on conflict do nothing;

-- colors (the old SELL_COLORS list, name + hex) ------------------------------
insert into public.colors (name, hex) values
  ('Onyx','#0a0a0a'),('Graphite','#374151'),('Silver','#c0c4cc'),('Pearl','#f1f3f6'),
  ('Gold','#d4af37'),('Rose Gold','#b76e79'),('Bronze','#a16207'),('Crimson','#dc2626'),
  ('Coral','#fb7185'),('Amber','#f59e0b'),('Lime','#84cc16'),('Emerald','#10b981'),
  ('Teal','#14b8a6'),('Cyan','#22d3ee'),('Sky','#38bdf8'),('Indigo','#6366f1'),
  ('Violet','#a855f7'),('Magenta','#ec4899'),('Navy','#1e3a8a'),('Forest','#166534'),
  ('White','#ffffff'),('Cream','#f5e6c8'),('Beige','#d8c3a5'),('Khaki','#78716c'),
  ('Olive','#4d7c0f'),('Mint','#6ee7b7'),('Turquoise','#06b6d4'),('Sapphire','#2563eb'),
  ('Royal','#4338ca'),('Purple','#7c3aed'),('Lavender','#c4b5fd'),('Plum','#86198f'),
  ('Burgundy','#7f1d1d'),('Brown','#78350f'),('Chocolate','#5c4033'),('Sand','#eab308'),
  ('Peach','#fdba74'),('Rose','#f472b6'),('Slate','#64748b'),('Steel','#94a3b8'),('Charcoal','#1f2937')
on conflict do nothing;

-- tags: a sensible default set + anything sellers already tagged --------------
insert into public.tags (name) values
  ('electronics'),('phones'),('computers'),('laptops'),('furniture'),('medicine'),
  ('fashion'),('footwear'),('cosplay'),('collectible'),('gaming'),('luxury'),
  ('vintage'),('new'),('sale'),('limited'),('handmade'),('accessories')
on conflict do nothing;

insert into public.tags (name)
  select distinct lower(trim(t)) from public.products p, lateral unnest(p.tags) as t
  where coalesce(trim(t), '') <> ''
on conflict do nothing;
