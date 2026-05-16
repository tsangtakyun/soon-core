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

  delete from public.projects where workspace_id = target_workspace_id;
  delete from public.docs where workspace_id = target_workspace_id;
  delete from public.expenses where workspace_id = target_workspace_id;
  delete from public.reply_threads where workspace_id = target_workspace_id;
  delete from public.financial_reports where workspace_id = target_workspace_id;
  delete from public.doc_folders where workspace_id = target_workspace_id;
  delete from public.invitations where workspace_id = target_workspace_id;
  delete from public.workspace_members where workspace_id = target_workspace_id;
  delete from public.workspaces where id = target_workspace_id;
end;
$$;

grant execute on function public.soon_delete_workspace(uuid) to authenticated;

notify pgrst, 'reload schema';
