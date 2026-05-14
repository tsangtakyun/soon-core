alter table public.projects
  add column if not exists publish_date date;

notify pgrst, 'reload schema';
