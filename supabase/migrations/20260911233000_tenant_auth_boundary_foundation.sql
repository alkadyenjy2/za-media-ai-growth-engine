create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
grant select, insert, update, delete on table public.workspaces to authenticated;
grant select, insert, update, delete on table public.workspace_members to authenticated;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;

create policy "workspace members can read workspaces"
  on public.workspaces for select
  to authenticated
  using ((select public.is_workspace_member(id)));

create policy "workspace members can read memberships"
  on public.workspace_members for select
  to authenticated
  using ((select public.is_workspace_member(workspace_id)));

create policy "workspace admins can manage memberships"
  on public.workspace_members for all
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members admin_member
      where admin_member.workspace_id = workspace_members.workspace_id
        and admin_member.user_id = (select auth.uid())
        and admin_member.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members admin_member
      where admin_member.workspace_id = workspace_members.workspace_id
        and admin_member.user_id = (select auth.uid())
        and admin_member.role in ('owner','admin')
    )
  );

insert into public.workspaces (name, slug)
values ('ZA Media', 'za-media')
on conflict (slug) do nothing;

alter table public.prospect_profiles add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prospect_evidence add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prospect_intent_signals add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prospect_opportunities add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prospect_service_matches add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.prospect_outreach_events add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.meta_connections add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.meta_prospect_targets add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
alter table public.audit_logs add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

update public.prospect_profiles p set workspace_id=w.id from public.workspaces w where w.slug='za-media' and p.workspace_id is null;
update public.prospect_evidence e set workspace_id=p.workspace_id from public.prospect_profiles p where p.id=e.prospect_id and e.workspace_id is null;
update public.prospect_intent_signals s set workspace_id=p.workspace_id from public.prospect_profiles p where p.id=s.prospect_id and s.workspace_id is null;
update public.prospect_opportunities o set workspace_id=p.workspace_id from public.prospect_profiles p where p.id=o.prospect_id and o.workspace_id is null;
update public.prospect_service_matches m set workspace_id=p.workspace_id from public.prospect_profiles p where p.id=m.prospect_id and m.workspace_id is null;
update public.prospect_outreach_events e set workspace_id=p.workspace_id from public.prospect_profiles p where p.id=e.prospect_id and e.workspace_id is null;
update public.meta_connections m set workspace_id=w.id from public.workspaces w where w.slug='za-media' and m.workspace_id is null;
update public.meta_prospect_targets t set workspace_id=m.workspace_id from public.meta_connections m where m.id=t.connection_id and t.workspace_id is null;

create index if not exists idx_prospect_profiles_workspace on public.prospect_profiles(workspace_id);
create index if not exists idx_prospect_evidence_workspace on public.prospect_evidence(workspace_id);
create index if not exists idx_prospect_intent_signals_workspace on public.prospect_intent_signals(workspace_id);
create index if not exists idx_prospect_opportunities_workspace on public.prospect_opportunities(workspace_id);
create index if not exists idx_prospect_service_matches_workspace on public.prospect_service_matches(workspace_id);
create index if not exists idx_prospect_outreach_events_workspace on public.prospect_outreach_events(workspace_id);
create index if not exists idx_meta_connections_workspace on public.meta_connections(workspace_id);
create index if not exists idx_meta_prospect_targets_workspace on public.meta_prospect_targets(workspace_id);
create index if not exists idx_audit_logs_workspace on public.audit_logs(workspace_id);
