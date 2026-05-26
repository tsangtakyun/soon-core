alter table public.trends
  add column if not exists deadline_at timestamptz,
  add column if not exists deadline_timezone text default 'Asia/Hong_Kong',
  add column if not exists news_headlines jsonb default '[]'::jsonb;

notify pgrst, 'reload schema';
