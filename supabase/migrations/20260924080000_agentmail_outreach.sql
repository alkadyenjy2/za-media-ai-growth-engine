-- ZA Media: AgentMail outbound approval, dispatch, inbound reconciliation and suppression guard.

create table if not exists public.outreach_suppressions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('bounce','unsubscribe','complaint','manual','rejected')),
  source text not null default 'agentmail',
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  suppressed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, email)
);

create table if not exists public.outreach_inbound_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'agentmail',
  inbox_id text not null,
  message_id text not null,
  thread_id text,
  from_email text,
  subject text,
  event_type text not null check (event_type in ('reply','bounce','complaint','rejected','other')),
  body text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(workspace_id, provider, message_id)
);

create table if not exists public.integration_sync_state (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  integration_key text not null,
  cursor_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(workspace_id, provider, integration_key)
);

create index if not exists idx_outreach_suppressions_workspace_email on public.outreach_suppressions(workspace_id, lower(email));
create index if not exists idx_outreach_inbound_workspace_occurred on public.outreach_inbound_messages(workspace_id, occurred_at desc);
create index if not exists idx_outreach_inbound_thread on public.outreach_inbound_messages(workspace_id, thread_id);
create index if not exists idx_integration_sync_state_key on public.integration_sync_state(workspace_id, provider, integration_key);

alter table public.outreach_suppressions enable row level security;
alter table public.outreach_inbound_messages enable row level security;
alter table public.integration_sync_state enable row level security;

revoke all on table public.outreach_suppressions, public.outreach_inbound_messages, public.integration_sync_state from anon;
grant select, insert, update, delete on table public.outreach_suppressions, public.outreach_inbound_messages, public.integration_sync_state to authenticated;

create policy outreach_suppressions_workspace_select on public.outreach_suppressions for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy outreach_suppressions_workspace_insert on public.outreach_suppressions for insert to authenticated with check ((select public.is_workspace_member(workspace_id)));
create policy outreach_suppressions_workspace_update on public.outreach_suppressions for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy outreach_suppressions_workspace_delete on public.outreach_suppressions for delete to authenticated using ((select public.is_workspace_member(workspace_id)));

create policy outreach_inbound_workspace_select on public.outreach_inbound_messages for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy outreach_inbound_workspace_insert on public.outreach_inbound_messages for insert to authenticated with check ((select public.is_workspace_member(workspace_id)));
create policy outreach_inbound_workspace_update on public.outreach_inbound_messages for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy outreach_inbound_workspace_delete on public.outreach_inbound_messages for delete to authenticated using ((select public.is_workspace_member(workspace_id)));

create policy integration_sync_state_workspace_select on public.integration_sync_state for select to authenticated using ((select public.is_workspace_member(workspace_id)));
create policy integration_sync_state_workspace_insert on public.integration_sync_state for insert to authenticated with check ((select public.is_workspace_member(workspace_id)));
create policy integration_sync_state_workspace_update on public.integration_sync_state for update to authenticated using ((select public.is_workspace_member(workspace_id))) with check ((select public.is_workspace_member(workspace_id)));
create policy integration_sync_state_workspace_delete on public.integration_sync_state for delete to authenticated using ((select public.is_workspace_member(workspace_id)));

create or replace function public.is_outreach_suppressed(target_workspace_id uuid, target_email text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (
  select 1 from public.outreach_suppressions
  where workspace_id = target_workspace_id and lower(email) = lower(btrim(target_email))
); $$;
revoke all on function public.is_outreach_suppressed(uuid,text) from public, anon, authenticated;
grant execute on function public.is_outreach_suppressed(uuid,text) to service_role;
