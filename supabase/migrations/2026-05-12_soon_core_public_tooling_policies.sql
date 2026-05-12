alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.docs enable row level security;

drop policy if exists "soon_core_public_select_workspaces" on public.workspaces;
drop policy if exists "soon_core_public_insert_workspaces" on public.workspaces;
drop policy if exists "soon_core_public_update_workspaces" on public.workspaces;
drop policy if exists "soon_core_public_delete_workspaces" on public.workspaces;

create policy "soon_core_public_select_workspaces"
  on public.workspaces for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_workspaces"
  on public.workspaces for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_workspaces"
  on public.workspaces for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_workspaces"
  on public.workspaces for delete
  to anon, authenticated
  using (true);

drop policy if exists "soon_core_public_select_projects" on public.projects;
drop policy if exists "soon_core_public_insert_projects" on public.projects;
drop policy if exists "soon_core_public_update_projects" on public.projects;
drop policy if exists "soon_core_public_delete_projects" on public.projects;

create policy "soon_core_public_select_projects"
  on public.projects for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_projects"
  on public.projects for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_projects"
  on public.projects for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_projects"
  on public.projects for delete
  to anon, authenticated
  using (true);

drop policy if exists "soon_core_public_select_docs" on public.docs;
drop policy if exists "soon_core_public_insert_docs" on public.docs;
drop policy if exists "soon_core_public_update_docs" on public.docs;
drop policy if exists "soon_core_public_delete_docs" on public.docs;

create policy "soon_core_public_select_docs"
  on public.docs for select
  to anon, authenticated
  using (true);

create policy "soon_core_public_insert_docs"
  on public.docs for insert
  to anon, authenticated
  with check (true);

create policy "soon_core_public_update_docs"
  on public.docs for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "soon_core_public_delete_docs"
  on public.docs for delete
  to anon, authenticated
  using (true);

notify pgrst, 'reload schema';
