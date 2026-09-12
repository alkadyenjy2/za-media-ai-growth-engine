create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and role in ('owner','admin')
  );
$$;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

create or replace function public.claim_unowned_workspace(target_workspace_slug text)
returns public.workspaces language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); ws public.workspaces;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into ws from public.workspaces where slug = lower(btrim(target_workspace_slug)) for update;
  if ws.id is null then raise exception 'Workspace not found' using errcode='P0002'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = ws.id) then
    raise exception 'Workspace already has members' using errcode='42501';
  end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(ws.id,caller,'owner');
  update public.workspaces set created_by=caller, updated_at=now() where id=ws.id returning * into ws;
  return ws;
end;
$$;
revoke all on function public.claim_unowned_workspace(text) from public, anon;
grant execute on function public.claim_unowned_workspace(text) to authenticated;

create or replace function public.create_workspace_with_owner(workspace_name text, workspace_slug text)
returns public.workspaces language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); ws public.workspaces;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if workspace_name is null or btrim(workspace_name)='' or workspace_slug is null or btrim(workspace_slug)='' then raise exception 'Workspace name and slug are required'; end if;
  if exists (select 1 from public.workspace_members where user_id=caller) then raise exception 'User already belongs to a workspace' using errcode='42501'; end if;
  insert into public.workspaces(name,slug,created_by) values(btrim(workspace_name),lower(btrim(workspace_slug)),caller) returning * into ws;
  insert into public.workspace_members(workspace_id,user_id,role) values(ws.id,caller,'owner');
  return ws;
end;
$$;
revoke all on function public.create_workspace_with_owner(text,text) from public, anon;
grant execute on function public.create_workspace_with_owner(text,text) to authenticated;

alter table public.workspace_members enable row level security;
alter table public.workspaces enable row level security;

alter table public.prospect_geo_assessments add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
update public.prospect_geo_assessments a set workspace_id = p.workspace_id from public.prospect_profiles p where p.id = a.prospect_id and a.workspace_id is null;
create index if not exists idx_prospect_geo_assessments_workspace_id on public.prospect_geo_assessments(workspace_id);

do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies where schemaname='public' and tablename in ('prospect_profiles','prospect_evidence','prospect_intent_signals','prospect_opportunities','prospect_service_matches','prospect_outreach_events','meta_connections','meta_prospect_targets','audit_logs','prospect_geo_assessments','workspace_members','workspaces') loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create policy workspace_read on public.workspaces for select to authenticated using ((select public.is_workspace_member(id)));
create policy workspace_update on public.workspaces for update to authenticated using ((select public.is_workspace_admin(id))) with check ((select public.is_workspace_admin(id)));
create policy membership_read on public.workspace_members for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy membership_admin_all on public.workspace_members for all to authenticated using ((select public.is_workspace_admin(workspace_id))) with check ((select public.is_workspace_admin(workspace_id)));

do $$ declare t text; begin
  foreach t in array array['prospect_profiles','prospect_evidence','prospect_intent_signals','prospect_opportunities','prospect_service_matches','prospect_outreach_events','meta_connections','meta_prospect_targets','audit_logs','prospect_geo_assessments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon',t);
    execute format('grant select,insert,update,delete on table public.%I to authenticated',t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_workspace_member(workspace_id)))',t||'_workspace_select',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (workspace_id is not null and (select public.is_workspace_member(workspace_id)))',t||'_workspace_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check (workspace_id is not null and (select public.is_workspace_member(workspace_id)))',t||'_workspace_update',t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_workspace_member(workspace_id)))',t||'_workspace_delete',t);
  end loop;
end $$;

create or replace function public.set_audit_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_id is null and auth.uid() is not null then
    select wm.workspace_id into new.workspace_id
    from public.workspace_members wm
    where wm.user_id = (select auth.uid())
    limit 1;
  end if;
  return new;
end;
$$;
drop trigger if exists audit_logs_workspace_default on public.audit_logs;
create trigger audit_logs_workspace_default before insert on public.audit_logs for each row execute function public.set_audit_workspace();
revoke all on function public.set_audit_workspace() from public, anon, authenticated;
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
