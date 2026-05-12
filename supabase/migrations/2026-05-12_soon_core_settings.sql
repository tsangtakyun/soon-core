create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id text default 'tommy',
  company_name text,
  email text,
  phone text,
  address text,
  bank_name text,
  account_name text,
  account_number text,
  tax_rate numeric default 0,
  default_rates jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists settings_user_id_key
  on public.settings(user_id);

alter table public.settings enable row level security;

drop policy if exists "soon_core_public_select_settings" on public.settings;
drop policy if exists "soon_core_public_insert_settings" on public.settings;
drop policy if exists "soon_core_public_update_settings" on public.settings;

create policy "soon_core_public_select_settings"
  on public.settings for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_settings"
  on public.settings for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_settings"
  on public.settings for update
  to anon, authenticated
  using (true)
  with check (true);

notify pgrst, 'reload schema';
