-- P0-11: deterministic GEO / AI Search Intelligence assessment history.
-- Stores auditable scores separately from raw evidence. No synthetic visibility
-- measurements are created; live AI-engine visibility must be measured separately.
create table if not exists public.prospect_geo_assessments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospect_profiles(id) on delete cascade,
  assessment_version text not null default 'p0-11-v1',
  overall_score integer not null check (overall_score between 0 and 100),
  confidence integer not null check (confidence between 0 and 100),
  measurement_status text not null default 'deterministic',
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  source_evidence_ids uuid[] not null default '{}',
  measured_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_prospect_geo_assessments_prospect on public.prospect_geo_assessments(prospect_id, created_at desc);
alter table public.prospect_geo_assessments enable row level security;
create policy "Shared workspace GEO assessments select" on public.prospect_geo_assessments for select to anon, authenticated using (true);
create policy "Shared workspace GEO assessments insert" on public.prospect_geo_assessments for insert to anon, authenticated with check (true);
create policy "Shared workspace GEO assessments update" on public.prospect_geo_assessments for update to anon, authenticated using (true) with check (true);
create policy "Shared workspace GEO assessments delete" on public.prospect_geo_assessments for delete to anon, authenticated using (true);
