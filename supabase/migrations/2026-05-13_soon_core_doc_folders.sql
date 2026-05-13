create table if not exists public.doc_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.docs
  add column if not exists folder_id uuid references public.doc_folders(id) on delete set null;

alter table public.doc_folders enable row level security;

drop policy if exists "Allow public doc folder read" on public.doc_folders;
drop policy if exists "Allow public doc folder insert" on public.doc_folders;
drop policy if exists "Allow public doc folder update" on public.doc_folders;
drop policy if exists "Allow public doc folder delete" on public.doc_folders;

create policy "Allow public doc folder read"
  on public.doc_folders for select
  using (true);

create policy "Allow public doc folder insert"
  on public.doc_folders for insert
  with check (true);

create policy "Allow public doc folder update"
  on public.doc_folders for update
  using (true)
  with check (true);

create policy "Allow public doc folder delete"
  on public.doc_folders for delete
  using (true);

notify pgrst, 'reload schema';
