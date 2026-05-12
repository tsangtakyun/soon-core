alter table public.workspaces
  add column if not exists owner text,
  add column if not exists description text;

notify pgrst, 'reload schema';
