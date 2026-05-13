alter table public.settings
  add column if not exists youtube_client_id text,
  add column if not exists youtube_client_secret text,
  add column if not exists meta_app_id text,
  add column if not exists meta_app_secret text;

notify pgrst, 'reload schema';
