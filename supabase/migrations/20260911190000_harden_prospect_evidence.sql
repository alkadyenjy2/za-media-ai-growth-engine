-- Growth Intelligence P0-02: evidence graph hardening.
-- Adds provenance, freshness, dedupe and business-impact fields without replacing
-- the P0-01 evidence table.

alter table public.prospect_evidence
  add column if not exists evidence_key text,
  add column if not exists evidence_status text not null default 'active'
    check (evidence_status in ('active','stale','invalid','superseded')),
  add column if not exists extractor text,
  add column if not exists severity text
    check (severity in ('info','low','medium','high','critical')),
  add column if not exists impact text,
  add column if not exists content_hash text,
  add column if not exists http_status integer,
  add column if not exists mime_type text;

create index if not exists idx_prospect_evidence_key
  on public.prospect_evidence(prospect_id, evidence_key, observed_at desc);
create index if not exists idx_prospect_evidence_freshness
  on public.prospect_evidence(prospect_id, evidence_status, expires_at);
create index if not exists idx_prospect_evidence_hash
  on public.prospect_evidence(prospect_id, content_hash);

comment on column public.prospect_evidence.evidence_key is 'Stable machine-readable key for the claim, used for dedupe and re-observation.';
comment on column public.prospect_evidence.evidence_status is 'Lifecycle state of this evidence observation.';
comment on column public.prospect_evidence.extractor is 'Component or method that produced the observation.';
comment on column public.prospect_evidence.content_hash is 'Hash of the normalized source observation for change detection.';
