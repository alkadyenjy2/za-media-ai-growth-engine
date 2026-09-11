-- Growth Intelligence P0-01: Unified Business / Prospect Profile foundation.
-- Keeps canonical prospect identity separate from evidence, intent, opportunities,
-- service matching, and outreach events so later intelligence layers can evolve
-- without rewriting the profile model.

create table if not exists public.prospect_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  canonical_name text not null,
  legal_name text,
  website_url text,
  domain text,
  industry text,
  sub_industry text,
  country text,
  city text,
  description text,
  lifecycle_status text not null default 'discovered'
    check (lifecycle_status in ('discovered','researching','qualified','engaged','customer','disqualified','archived')),
  fit_score integer check (fit_score between 0 and 100),
  intent_score integer check (intent_score between 0 and 100),
  opportunity_score integer check (opportunity_score between 0 and 100),
  priority_score integer check (priority_score between 0 and 100),
  confidence_score integer check (confidence_score between 0 and 100),
  last_scored_at timestamptz,
  last_observed_at timestamptz,
  next_review_at timestamptz,
  profile_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id),
  unique(domain)
);

create table if not exists public.prospect_evidence (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  evidence_type text not null
    check (evidence_type in ('identity','website','social','seo','geo','intent','firmographic','technographic','behavior','review','campaign','other')),
  source_type text not null
    check (source_type in ('public','first_party','internal','derived')),
  source_name text not null,
  source_url text,
  claim text not null,
  evidence_data jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) check (confidence between 0 and 1),
  observed_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_intent_signals (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  signal_type text not null
    check (signal_type in ('hiring','expansion','launch','campaign','website_change','content_change','leadership_change','job_change','ad_activity','technology_change','engagement','other')),
  strength integer not null default 50 check (strength between 0 and 100),
  evidence_id uuid references public.prospect_evidence(id) on delete set null,
  signal_data jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_opportunities (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  opportunity_type text not null,
  problem text not null,
  business_impact text,
  evidence_id uuid references public.prospect_evidence(id) on delete set null,
  opportunity_score integer check (opportunity_score between 0 and 100),
  status text not null default 'identified'
    check (status in ('identified','reviewed','approved','rejected','active','won','lost','expired')),
  opportunity_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prospect_service_matches (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  opportunity_id uuid references public.prospect_opportunities(id) on delete cascade,
  service_name text not null,
  offer_name text,
  rationale text,
  expected_outcome text,
  fit_score integer check (fit_score between 0 and 100),
  match_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.prospect_outreach_events (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  opportunity_id uuid references public.prospect_opportunities(id) on delete set null,
  channel text not null
    check (channel in ('email','facebook','instagram','whatsapp','phone','other')),
  event_type text not null
    check (event_type in ('drafted','reviewed','approved','sent','delivered','opened','replied','positive','negative','question','not_now','wrong_person','unsubscribe','no_response','follow_up','stopped')),
  content text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_prospect_profiles_priority on public.prospect_profiles(priority_score desc nulls last, updated_at desc);
create index if not exists idx_prospect_profiles_status on public.prospect_profiles(lifecycle_status, updated_at desc);
create index if not exists idx_prospect_evidence_prospect_observed on public.prospect_evidence(prospect_id, observed_at desc);
create index if not exists idx_prospect_evidence_source on public.prospect_evidence(source_type, evidence_type);
create index if not exists idx_prospect_intent_prospect_detected on public.prospect_intent_signals(prospect_id, detected_at desc);
create index if not exists idx_prospect_intent_active on public.prospect_intent_signals(signal_type, strength desc, detected_at desc);
create index if not exists idx_prospect_opportunities_prospect_status on public.prospect_opportunities(prospect_id, status, updated_at desc);
create index if not exists idx_prospect_service_matches_prospect on public.prospect_service_matches(prospect_id, fit_score desc nulls last);
create index if not exists idx_prospect_outreach_prospect_occurred on public.prospect_outreach_events(prospect_id, occurred_at desc);

alter table public.prospect_profiles enable row level security;
alter table public.prospect_evidence enable row level security;
alter table public.prospect_intent_signals enable row level security;
alter table public.prospect_opportunities enable row level security;
alter table public.prospect_service_matches enable row level security;
alter table public.prospect_outreach_events enable row level security;

-- Single-tenant operations workspace: explicit anon/authenticated CRUD policies
-- match the existing core workspace model. Sensitive external credentials are not
-- stored in these tables.
create policy "Shared workspace prospect profiles select" on public.prospect_profiles for select to anon, authenticated using (true);
create policy "Shared workspace prospect profiles insert" on public.prospect_profiles for insert to anon, authenticated with check (true);
create policy "Shared workspace prospect profiles update" on public.prospect_profiles for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace prospect profiles delete" on public.prospect_profiles for delete to anon, authenticated using (true);

create policy "Shared workspace prospect evidence select" on public.prospect_evidence for select to anon, authenticated using (true);
create policy "Shared workspace prospect evidence insert" on public.prospect_evidence for insert to anon, authenticated with check (true);
create policy "Shared workspace prospect evidence update" on public.prospect_evidence for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace prospect evidence delete" on public.prospect_evidence for delete to anon, authenticated using (true);

create policy "Shared workspace prospect intent select" on public.prospect_intent_signals for select to anon, authenticated using (true);
create policy "Shared workspace prospect intent insert" on public.prospect_intent_signals for insert to anon, authenticated with check (true);
create policy "Shared workspace prospect intent update" on public.prospect_intent_signals for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace prospect intent delete" on public.prospect_intent_signals for delete to anon, authenticated using (true);

create policy "Shared workspace prospect opportunities select" on public.prospect_opportunities for select to anon, authenticated using (true);
create policy "Shared workspace prospect opportunities insert" on public.prospect_opportunities for insert to anon, authenticated with check (true);
create policy "Shared workspace prospect opportunities update" on public.prospect_opportunities for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace prospect opportunities delete" on public.prospect_opportunities for delete to anon, authenticated using (true);

create policy "Shared workspace prospect service matches select" on public.prospect_service_matches for select to anon, authenticated using (true);
create policy "Shared workspace prospect service matches insert" on public.prospect_service_matches for insert to anon, authenticated with check (true);
create policy "Shared workspace prospect service matches update" on public.prospect_service_matches for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace prospect service matches delete" on public.prospect_service_matches for delete to anon, authenticated using (true);

create policy "Shared workspace prospect outreach select" on public.prospect_outreach_events for select to anon, authenticated using (true);
create policy "Shared workspace prospect outreach insert" on public.prospect_outreach_events for insert to anon, authenticated with check (true);
create policy "Shared workspace prospect outreach update" on public.prospect_outreach_events for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace prospect outreach delete" on public.prospect_outreach_events for delete to anon, authenticated using (true);
