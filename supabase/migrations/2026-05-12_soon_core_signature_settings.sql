alter table public.settings
  add column if not exists signature_base64 text;

notify pgrst, 'reload schema';
