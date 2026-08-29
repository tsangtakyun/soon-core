create extension if not exists pgcrypto;

create table if not exists public.topic_directions (
  id text primary key,
  parent_id text references public.topic_directions(id) on delete set null,
  label_zh text not null,
  label_en text,
  aliases text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topic_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  why_now text not null default '',
  hook text not null default '',
  suggested_angles jsonb not null default '[]'::jsonb,
  content_formats text[] not null default '{}',
  countries text[] not null default '{}',
  regions text[] not null default '{}',
  localities text[] not null default '{}',
  languages text[] not null default '{zh-HK}',
  keywords text[] not null default '{}',
  cover_url text,
  cover_alt text,
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topic_item_directions (
  topic_id uuid not null references public.topic_items(id) on delete cascade,
  direction_id text not null references public.topic_directions(id) on delete restrict,
  is_primary boolean not null default false,
  confidence numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  primary key (topic_id, direction_id)
);

create table if not exists public.topic_sources (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topic_items(id) on delete cascade,
  url text not null,
  source_name text,
  source_title text,
  published_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (topic_id, url)
);

create index if not exists topic_items_feed_idx
  on public.topic_items(status, published_at desc, created_at desc);
create index if not exists topic_items_regions_idx on public.topic_items using gin(regions);
create index if not exists topic_items_localities_idx on public.topic_items using gin(localities);
create index if not exists topic_items_keywords_idx on public.topic_items using gin(keywords);
create index if not exists topic_item_directions_direction_idx
  on public.topic_item_directions(direction_id, topic_id);

alter table public.topic_directions enable row level security;
alter table public.topic_items enable row level security;
alter table public.topic_item_directions enable row level security;
alter table public.topic_sources enable row level security;

revoke all on public.topic_directions from anon, authenticated;
revoke all on public.topic_items from anon, authenticated;
revoke all on public.topic_item_directions from anon, authenticated;
revoke all on public.topic_sources from anon, authenticated;
grant all on public.topic_directions to service_role;
grant all on public.topic_items to service_role;
grant all on public.topic_item_directions to service_role;
grant all on public.topic_sources to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'topic-covers',
  'topic-covers',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.topic_directions (id, parent_id, label_zh, label_en, aliases, sort_order)
values
  ('food', null, '美食', 'Food', array['飲食', '餐飲'], 10),
  ('food-dining', 'food', '餐廳探店', 'Dining', array['探店', '餐廳', '餐廳推薦'], 11),
  ('food-home', 'food', '家庭料理', 'Home cooking', array['食譜', '煮食'], 12),
  ('food-knowledge', 'food', '食物知識', 'Food knowledge', array['食物科學', '飲食知識'], 13),
  ('travel', null, '旅遊', 'Travel', array['旅行', '旅遊資訊'], 20),
  ('travel-city', 'travel', '城市攻略', 'City guide', array['城市旅遊', '自由行'], 21),
  ('travel-hotel', 'travel', '酒店住宿', 'Hotels', array['酒店', '住宿'], 22),
  ('travel-culture', 'travel', '文化體驗', 'Culture', array['文化', '在地體驗'], 23),
  ('lifestyle', null, '生活', 'Lifestyle', array['生活日常'], 30),
  ('lifestyle-health', 'lifestyle', '健康生活', 'Health', array['健康', '養生'], 31),
  ('lifestyle-relationship', 'lifestyle', '關係與情感', 'Relationships', array['relationship', '感情'], 32),
  ('lifestyle-home', 'lifestyle', '家居生活', 'Home', array['家居', '居家'], 33),
  ('lifestyle-pets', 'lifestyle', '寵物', 'Pets', array['動物', '毛孩'], 34),
  ('entertainment', null, '娛樂', 'Entertainment', array['影視娛樂'], 40),
  ('entertainment-film', 'entertainment', '電影影集', 'Film and TV', array['電影', '影集'], 41),
  ('entertainment-music', 'entertainment', '音樂', 'Music', array['歌曲', '歌手'], 42),
  ('entertainment-people', 'entertainment', '人物故事', 'People', array['名人', '人物'], 43),
  ('business', null, '商業與創作', 'Business and creators', array['商業'], 50),
  ('business-brand', 'business', '品牌案例', 'Brand cases', array['品牌', '行銷案例'], 51),
  ('business-social', 'business', '社交媒體', 'Social media', array['社群媒體', 'social media'], 52),
  ('business-creator', 'business', '創作者經濟', 'Creator economy', array['內容創作', '品牌合作'], 53),
  ('news-culture', null, '城市與文化熱話', 'Culture and city trends', array['城市熱話', '文化現象', 'Trending 最新資訊'], 60)
on conflict (id) do update set
  parent_id = excluded.parent_id,
  label_zh = excluded.label_zh,
  label_en = excluded.label_en,
  aliases = excluded.aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

notify pgrst, 'reload schema';
