-- AI Layer: lead qualification + growth audits
-- Keeps AI output separate from the core lead score and preserves auditability.

alter table public.leads
  add column if not exists ai_score integer check (ai_score between 0 and 100),
  add column if not exists ai_qualification text check (ai_qualification in ('low','medium','high')),
  add column if not exists ai_reasoning text,
  add column if not exists ai_recommended_action text,
  add column if not exists ai_confidence numeric(5,4) check (ai_confidence between 0 and 1),
  add column if not exists ai_evaluated_at timestamptz;

create table if not exists public.ai_audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  audit_type text not null default 'growth',
  overall_score integer check (overall_score between 0 and 100),
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  priority text,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ai_audits enable row level security;

create policy "anon can read ai audits"
  on public.ai_audits for select to anon using (true);
create policy "anon can insert ai audits"
  on public.ai_audits for insert to anon with check (true);
create policy "authenticated can read ai audits"
  on public.ai_audits for select to authenticated using (true);
create policy "authenticated can insert ai audits"
  on public.ai_audits for insert to authenticated with check (true);

create index if not exists idx_ai_audits_company_created
  on public.ai_audits(company_id, created_at desc);

create index if not exists idx_ai_audits_lead_created
  on public.ai_audits(lead_id, created_at desc);
