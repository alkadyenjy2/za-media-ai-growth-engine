create or replace function public.create_workspace_with_owner(
  workspace_name text,
  workspace_slug text
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_workspace public.workspaces;
  result public.workspaces;
begin
  if uid is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(workspace_name), '') is null or nullif(trim(workspace_slug), '') is null then
    raise exception 'Workspace name and slug are required';
  end if;

  select * into existing_workspace
  from public.workspaces
  where slug = trim(workspace_slug)
  limit 1;

  if existing_workspace.id is not null then
    if public.is_workspace_member(existing_workspace.id) then
      return existing_workspace;
    end if;

    if exists (
      select 1
      from public.workspace_members
      where workspace_id = existing_workspace.id
    ) then
      raise exception 'Workspace already has members';
    end if;

    insert into public.workspace_members(workspace_id, user_id, role)
    values (existing_workspace.id, uid, 'owner')
    on conflict (workspace_id, user_id) do nothing;

    return existing_workspace;
  end if;

  insert into public.workspaces(name, slug, created_by)
  values (trim(workspace_name), trim(workspace_slug), uid)
  returning * into result;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (result.id, uid, 'owner');

  return result;
exception
  when unique_violation then
    select * into existing_workspace
    from public.workspaces
    where slug = trim(workspace_slug)
    limit 1;

    if existing_workspace.id is not null and public.is_workspace_member(existing_workspace.id) then
      return existing_workspace;
    end if;

    raise exception 'Workspace slug already exists';
end;
$$;

revoke all on function public.create_workspace_with_owner(text, text) from public, anon;
grant execute on function public.create_workspace_with_owner(text, text) to authenticated;
