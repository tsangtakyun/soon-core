-- SOON CORE workspace creation RLS fix
-- Run this on the active SOON Core Supabase project.

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists workspaces_select_members on public.workspaces;
create policy workspaces_select_members on public.workspaces
for select using (
  id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists workspaces_insert_authenticated on public.workspaces;
create policy workspaces_insert_authenticated on public.workspaces
for insert with check (auth.uid() is not null);

drop policy if exists workspaces_update_admins on public.workspaces;
create policy workspaces_update_admins on public.workspaces
for update using (
  id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  )
) with check (
  id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  )
);

drop policy if exists workspaces_delete_owners on public.workspaces;
create policy workspaces_delete_owners on public.workspaces
for delete using (
  id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid()
      and status = 'active'
      and role = 'owner'
  )
);

drop policy if exists workspace_members_select_team on public.workspace_members;
create policy workspace_members_select_team on public.workspace_members
for select using (
  user_id = auth.uid()
  or workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists workspace_members_insert_self_owner on public.workspace_members;
create policy workspace_members_insert_self_owner on public.workspace_members
for insert with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and invited_by = auth.uid()
  and role = 'owner'
  and status = 'active'
);

drop policy if exists workspace_members_insert_admins on public.workspace_members;
create policy workspace_members_insert_admins on public.workspace_members
for insert with check (
  auth.uid() is not null
  and (
    invited_by = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'admin')
    )
  )
);

drop policy if exists workspace_members_update_admins on public.workspace_members;
create policy workspace_members_update_admins on public.workspace_members
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  )
);

drop policy if exists workspace_members_delete_owners on public.workspace_members;
create policy workspace_members_delete_owners on public.workspace_members
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid()
      and status = 'active'
      and role = 'owner'
  )
);

notify pgrst, 'reload schema';
