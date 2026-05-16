-- SOON CORE workspace delete RPC
-- Avoids recursive workspace_members RLS policies during delete.

create or replace function public.soon_delete_workspace(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  related_table text;
begin
  if current_user_id is null then
    raise exception 'Unauthorized';
  end if;

  if not exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and owner_id = current_user_id
  )
  and not exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = current_user_id
      and status = 'active'
      and role = 'owner'
  ) then
    raise exception 'Forbidden';
  end if;

  foreach related_table in array array[
    'projects',
    'docs',
    'expenses',
    'reply_threads',
    'financial_reports',
    'doc_folders',
    'invitations',
    'workspace_members'
  ]
  loop
    if to_regclass('public.' || related_table) is not null then
      execute format('delete from public.%I where workspace_id = $1', related_table)
      using target_workspace_id;
    end if;
  end loop;

  delete from public.workspaces where id = target_workspace_id;
end;
$$;

grant execute on function public.soon_delete_workspace(uuid) to authenticated;

notify pgrst, 'reload schema';
