alter table public.trends
  add column if not exists category text default 'news',
  add column if not exists keywords text;

update public.trends
set category = 'news'
where category is null;

notify pgrst, 'reload schema';
