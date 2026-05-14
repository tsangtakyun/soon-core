create table if not exists public.reply_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id),
  inbox_type text not null,
  sender_name text,
  sender_handle text,
  original_message text not null,
  ai_reply text,
  user_edited_reply text,
  status text default 'pending',
  tags text[] default '{}',
  notes text,
  follow_up_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reply_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text default 'tommy',
  inbox_type text not null,
  assistant_name text default 'Mayan',
  tone text default 'friendly',
  reply_length text default 'standard',
  creator_context text,
  avoid_topics text,
  created_at timestamptz default now()
);

create unique index if not exists reply_settings_user_inbox_key
  on public.reply_settings(user_id, inbox_type);

alter table public.reply_threads enable row level security;
alter table public.reply_settings enable row level security;

drop policy if exists "soon_core_public_select_reply_threads" on public.reply_threads;
drop policy if exists "soon_core_public_insert_reply_threads" on public.reply_threads;
drop policy if exists "soon_core_public_update_reply_threads" on public.reply_threads;
drop policy if exists "soon_core_public_delete_reply_threads" on public.reply_threads;

create policy "soon_core_public_select_reply_threads"
  on public.reply_threads for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_reply_threads"
  on public.reply_threads for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_reply_threads"
  on public.reply_threads for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_reply_threads"
  on public.reply_threads for delete
  to anon, authenticated
  using (true);

drop policy if exists "soon_core_public_select_reply_settings" on public.reply_settings;
drop policy if exists "soon_core_public_insert_reply_settings" on public.reply_settings;
drop policy if exists "soon_core_public_update_reply_settings" on public.reply_settings;
drop policy if exists "soon_core_public_delete_reply_settings" on public.reply_settings;

create policy "soon_core_public_select_reply_settings"
  on public.reply_settings for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_reply_settings"
  on public.reply_settings for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_reply_settings"
  on public.reply_settings for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_reply_settings"
  on public.reply_settings for delete
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
