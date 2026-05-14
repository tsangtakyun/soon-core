-- SOON CORE Auth + Team Management

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text default 'member',
  -- owner / admin / member
  status text default 'active',
  -- active / pending
  invited_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  email text not null,
  role text default 'member',
  token text unique default gen_random_uuid()::text,
  invited_by uuid references auth.users(id),
  status text default 'pending',
  -- pending / accepted / expired
  expires_at timestamptz default now() + interval '7 days',
  created_at timestamptz default now()
);

alter table public.workspaces
  add column if not exists owner_id uuid references auth.users(id);

alter table public.projects
  add column if not exists created_by uuid references auth.users(id);

alter table public.docs
  add column if not exists created_by uuid references auth.users(id);

alter table public.expenses
  add column if not exists created_by uuid references auth.users(id);

alter table public.reply_threads
  add column if not exists created_by uuid references auth.users(id);

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.docs enable row level security;
alter table public.expenses enable row level security;
alter table public.reply_threads enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;

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
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
) with check (
  id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
);

drop policy if exists workspaces_delete_owners on public.workspaces;
create policy workspaces_delete_owners on public.workspaces
for delete using (
  id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role = 'owner'
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

drop policy if exists workspace_members_insert_admins on public.workspace_members;
create policy workspace_members_insert_admins on public.workspace_members
for insert with check (
  auth.uid() is not null
  and (
    invited_by = auth.uid()
    or workspace_id in (
      select workspace_id from public.workspace_members
      where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
    )
  )
);

drop policy if exists workspace_members_update_admins on public.workspace_members;
create policy workspace_members_update_admins on public.workspace_members
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
);

drop policy if exists workspace_members_delete_owners on public.workspace_members;
create policy workspace_members_delete_owners on public.workspace_members
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role = 'owner'
  )
);

drop policy if exists invitations_select_admins on public.invitations;
create policy invitations_select_admins on public.invitations
for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
);

drop policy if exists invitations_insert_admins on public.invitations;
create policy invitations_insert_admins on public.invitations
for insert with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
);

drop policy if exists invitations_update_admins on public.invitations;
create policy invitations_update_admins on public.invitations
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
);

drop policy if exists invitations_delete_admins on public.invitations;
create policy invitations_delete_admins on public.invitations
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  )
);

drop policy if exists projects_workspace_members_select on public.projects;
create policy projects_workspace_members_select on public.projects
for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists projects_workspace_members_insert on public.projects;
create policy projects_workspace_members_insert on public.projects
for insert with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists projects_workspace_members_update on public.projects;
create policy projects_workspace_members_update on public.projects
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists projects_workspace_members_delete on public.projects;
create policy projects_workspace_members_delete on public.projects
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists docs_workspace_members_select on public.docs;
create policy docs_workspace_members_select on public.docs
for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists docs_workspace_members_insert on public.docs;
create policy docs_workspace_members_insert on public.docs
for insert with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists docs_workspace_members_update on public.docs;
create policy docs_workspace_members_update on public.docs
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists docs_workspace_members_delete on public.docs;
create policy docs_workspace_members_delete on public.docs
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists expenses_workspace_members_select on public.expenses;
create policy expenses_workspace_members_select on public.expenses
for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists expenses_workspace_members_insert on public.expenses;
create policy expenses_workspace_members_insert on public.expenses
for insert with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists expenses_workspace_members_update on public.expenses;
create policy expenses_workspace_members_update on public.expenses
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists expenses_workspace_members_delete on public.expenses;
create policy expenses_workspace_members_delete on public.expenses
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists reply_threads_workspace_members_select on public.reply_threads;
create policy reply_threads_workspace_members_select on public.reply_threads
for select using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists reply_threads_workspace_members_insert on public.reply_threads;
create policy reply_threads_workspace_members_insert on public.reply_threads
for insert with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists reply_threads_workspace_members_update on public.reply_threads;
create policy reply_threads_workspace_members_update on public.reply_threads
for update using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
) with check (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

drop policy if exists reply_threads_workspace_members_delete on public.reply_threads;
create policy reply_threads_workspace_members_delete on public.reply_threads
for delete using (
  workspace_id in (
    select workspace_id from public.workspace_members
    where user_id = auth.uid() and status = 'active'
  )
);

notify pgrst, 'reload schema';
