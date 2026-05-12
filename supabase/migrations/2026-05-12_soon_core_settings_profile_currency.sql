alter table public.settings
  add column if not exists logo_base64 text,
  add column if not exists display_name text default 'Tommy',
  add column if not exists default_currency text default 'HK$';

notify pgrst, 'reload schema';
