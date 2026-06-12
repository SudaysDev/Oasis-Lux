-- ============================================================================
-- OASIS LUX :: Phase 3 — Categories & subcategories (admin-managed taxonomy)
-- A real categories tree (sections + subsections) + product category/tags.
-- ============================================================================

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  parent_id  uuid references public.categories(id) on delete cascade,
  icon       text not null default 'Tag',   -- lucide icon name (UI hint)
  sort       integer not null default 100,
  created_at timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories(parent_id);

-- products: a primary category slug + free-form tags (iPhone = phones + electronics)
alter table public.products add column if not exists category text;
alter table public.products add column if not exists tags text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- RLS — everyone can read the taxonomy; only admins can manage it
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------------------------------------------------------------------------
-- Seed: top-level sections
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, icon, sort) values
  ('Fragrances',      'fragrances',  'SprayCan',    10),
  ('Watches',         'watches',     'Watch',       20),
  ('Eyewear',         'eyewear',     'Glasses',     30),
  ('Electronics',     'electronics', 'Cpu',         40),
  ('Phones',          'phones',      'Smartphone',  41),
  ('Computers',       'computers',   'Monitor',     42),
  ('Fashion',         'fashion',     'Shirt',       50),
  ('Footwear',        'footwear',    'Footprints',  51),
  ('Bags & Jewelry',  'bags-jewelry','Gem',         52),
  ('Home & Furniture','home',        'Sofa',        60),
  ('Beauty & Health', 'beauty',      'HeartPulse',  70),
  ('Hobby & Gaming',  'hobby',       'Gamepad2',    80),
  ('Kids & Toys',     'kids',        'Baby',        90),
  ('Auto & Moto',     'auto',        'Car',        100),
  ('Sports',          'sports',      'Dumbbell',   110)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: subcategories (linked to parents by slug)
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, parent_id, icon, sort)
select v.name, v.slug, p.id, v.icon, v.sort
from (values
  -- Fragrances
  ('Eau de Parfum','frag-edp','fragrances','SprayCan',1),
  ('Eau de Toilette','frag-edt','fragrances','SprayCan',2),
  ('Decants','frag-decants','fragrances','Droplet',3),
  ('Niche','frag-niche','fragrances','Sparkles',4),
  ('Arabic / Oud','frag-oud','fragrances','Flame',5),
  -- Watches
  ('Automatic','watch-auto','watches','Watch',1),
  ('Quartz','watch-quartz','watches','Watch',2),
  ('Smartwatch','watch-smart','watches','Watch',3),
  ('Luxury','watch-lux','watches','Crown',4),
  -- Eyewear
  ('Sunglasses','eye-sun','eyewear','Glasses',1),
  ('Optical','eye-optical','eyewear','Glasses',2),
  -- Electronics
  ('Laptops','el-laptops','electronics','Laptop',1),
  ('Tablets','el-tablets','electronics','Tablet',2),
  ('Audio & Headphones','el-audio','electronics','Headphones',3),
  ('Cameras','el-cameras','electronics','Camera',4),
  ('TV & Displays','el-tv','electronics','Tv',5),
  ('Accessories','el-acc','electronics','Cable',6),
  -- Phones
  ('Smartphones','ph-smart','phones','Smartphone',1),
  ('iPhone','ph-iphone','phones','Smartphone',2),
  ('Android','ph-android','phones','Smartphone',3),
  ('Phone Cases','ph-cases','phones','Smartphone',4),
  -- Computers
  ('Desktops','comp-desktop','computers','Monitor',1),
  ('Components','comp-parts','computers','Cpu',2),
  ('Keyboards & Mice','comp-periph','computers','Keyboard',3),
  -- Fashion
  ('Clothing','fa-clothing','fashion','Shirt',1),
  ('Suits','fa-suits','fashion','Shirt',2),
  ('Outerwear','fa-outer','fashion','Shirt',3),
  ('Hats & Caps','fa-hats','fashion','HardHat',4),
  -- Footwear
  ('Sneakers','fw-sneakers','footwear','Footprints',1),
  ('Boots','fw-boots','footwear','Footprints',2),
  ('Formal','fw-formal','footwear','Footprints',3),
  -- Bags & Jewelry
  ('Bags','bj-bags','bags-jewelry','ShoppingBag',1),
  ('Rings','bj-rings','bags-jewelry','Gem',2),
  ('Necklaces','bj-neck','bags-jewelry','Gem',3),
  -- Home & Furniture
  ('Furniture','home-furniture','home','Sofa',1),
  ('Sofas','home-sofas','home','Sofa',2),
  ('Chairs','home-chairs','home','Armchair',3),
  ('Lighting','home-light','home','Lamp',4),
  ('Kitchen','home-kitchen','home','Utensils',5),
  ('Decor','home-decor','home','Frame',6),
  -- Beauty & Health
  ('Skincare','be-skincare','beauty','Sparkles',1),
  ('Makeup','be-makeup','beauty','Brush',2),
  ('Medicine','be-medicine','beauty','Pill',3),
  ('Supplements','be-supp','beauty','Pill',4),
  -- Hobby & Gaming
  ('Cosplay','ho-cosplay','hobby','Drama',1),
  ('Collectibles','ho-collect','hobby','Trophy',2),
  ('Swords & Replicas','ho-swords','hobby','Sword',3),
  ('Stationery & Pens','ho-pens','hobby','PenTool',4),
  ('Board Games','ho-board','hobby','Dices',5),
  -- Kids & Toys
  ('Toys','kids-toys','kids','ToyBrick',1),
  ('Baby Care','kids-care','kids','Baby',2),
  -- Auto & Moto
  ('Car Accessories','auto-acc','auto','Car',1),
  ('Moto Gear','auto-moto','auto','Bike',2),
  -- Sports
  ('Fitness','sp-fitness','sports','Dumbbell',1),
  ('Outdoor','sp-outdoor','sports','Tent',2)
) as v(name, slug, parent_slug, icon, sort)
join public.categories p on p.slug = v.parent_slug
on conflict (slug) do nothing;
