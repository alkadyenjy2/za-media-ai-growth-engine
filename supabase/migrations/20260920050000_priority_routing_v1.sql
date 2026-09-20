-- ZA Media Priority Routing Layer v1.0.0
-- Versioned policy storage + workspace-scoped routing decisions.
-- Decision evaluation is intentionally implemented downstream; this migration
-- stores the policy contract and the resulting decision evidence.

create table if not exists public.priority_routing_policies (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  is_active boolean not null default false,
  thresholds jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint priority_routing_policies_thresholds_object
    check (jsonb_typeof(thresholds) = 'object')
);

create unique index if not exists idx_priority_routing_policies_active
  on public.priority_routing_policies (is_active)
  where is_active = true;

comment on table public.priority_routing_policies is
  'Versioned Priority Mapping policy contracts. Evaluation logic must read an active policy rather than hardcoding thresholds.';
comment on column public.priority_routing_policies.thresholds is
  'JSON policy contract for P1/P2/P3/RESEARCH_REQUIRED thresholds and evidence/freshness requirements.';

insert into public.priority_routing_policies (version, is_active, thresholds)
values (
  'v1.0.0',
  true,
  '{
    "P1": {
      "intent_min": 80,
      "priority_min": 75,
      "confidence_min": 70,
      "evidence_min": 2,
      "freshness_days": 30,
      "active_opportunity_required": true,
      "active_service_match_required": true
    },
    "P2": {
      "intent_min": 50,
      "intent_max": 79,
      "active_opportunity_required": true,
      "evidence_min": 1
    },
    "P3": {
      "intent_max": 49,
      "active_opportunity_required": false,
      "intent_signals_required": true,
      "evidence_required": true
    },
    "RESEARCH_REQUIRED": {
      "active_evidence_required": true,
      "expired_evidence_requires_research": true,
      "duplicate_content_hash_requires_research": true
    }
  }'::jsonb
)
on conflict (version) do update
set
  is_active = excluded.is_active,
  thresholds = excluded.thresholds,
  updated_at = now();

create table if not exists public.prospect_priority_decisions (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  policy_version text not null references public.priority_routing_policies(version),
  priority_tier text not null,
  intent_score numeric(5,2),
  priority_score numeric(5,2),
  confidence_score numeric(5,2),
  reasoning text not null,
  evidence_ids uuid[] not null default '{}'::uuid[],
  evidence_snapshot jsonb not null default '[]'::jsonb,
  active_opportunity boolean not null default false,
  active_service_match boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospect_priority_decisions_tier_check
    check (priority_tier in ('P1', 'P2', 'P3', 'RESEARCH_REQUIRED')),
  constraint prospect_priority_decisions_scores_check
    check (
      (intent_score is null or intent_score between 0 and 100)
      and (priority_score is null or priority_score between 0 and 100)
      and (confidence_score is null or confidence_score between 0 and 100)
    ),
  constraint prospect_priority_decisions_snapshot_object
    check (jsonb_typeof(evidence_snapshot) = 'array'),
  constraint prospect_priority_decisions_unique_policy
    unique (prospect_id, policy_version)
);

create index if not exists idx_prospect_priority_decisions_workspace
  on public.prospect_priority_decisions(workspace_id);

create index if not exists idx_prospect_priority_decisions_prospect
  on public.prospect_priority_decisions(prospect_id);

create index if not exists idx_prospect_priority_decisions_tier
  on public.prospect_priority_decisions(workspace_id, priority_tier);

alter table public.priority_routing_policies enable row level security;
alter table public.prospect_priority_decisions enable row level security;

revoke all on table public.priority_routing_policies from anon;
revoke all on table public.prospect_priority_decisions from anon;

grant select on table public.priority_routing_policies to authenticated;
grant select, insert, update, delete on table public.prospect_priority_decisions to authenticated;

drop policy if exists priority_routing_policies_authenticated_read
  on public.priority_routing_policies;
create policy priority_routing_policies_authenticated_read
  on public.priority_routing_policies
  for select to authenticated
  using (true);

drop policy if exists prospect_priority_decisions_workspace_select
  on public.prospect_priority_decisions;
create policy prospect_priority_decisions_workspace_select
  on public.prospect_priority_decisions
  for select to authenticated
  using ((select public.is_workspace_member(workspace_id)));

drop policy if exists prospect_priority_decisions_workspace_insert
  on public.prospect_priority_decisions;
create policy prospect_priority_decisions_workspace_insert
  on public.prospect_priority_decisions
  for insert to authenticated
  with check ((select public.is_workspace_member(workspace_id)));

drop policy if exists prospect_priority_decisions_workspace_update
  on public.prospect_priority_decisions;
create policy prospect_priority_decisions_workspace_update
  on public.prospect_priority_decisions
  for update to authenticated
  using ((select public.is_workspace_member(workspace_id)))
  with check ((select public.is_workspace_member(workspace_id)));

drop policy if exists prospect_priority_decisions_workspace_delete
  on public.prospect_priority_decisions;
create policy prospect_priority_decisions_workspace_delete
  on public.prospect_priority_decisions
  for delete to authenticated
  using ((select public.is_workspace_member(workspace_id)));

comment on table public.prospect_priority_decisions is
  'Immutable-by-policy-version routing result. One decision per prospect per policy version; evidence_snapshot preserves evidence IDs, content hashes, and expiry metadata used for the decision.';
comment on column public.prospect_priority_decisions.evidence_snapshot is
  'Evidence audit snapshot. Expected entries contain evidence_id, content_hash, expires_at, and other evidence metadata used by the routing decision.';
