-- ZA Media Meta lead boundary: idempotency + atomic prospect/evidence/audit persistence.
create unique index if not exists uq_meta_lead_evidence_key
  on public.prospect_evidence (workspace_id, evidence_key)
  where evidence_key like 'meta_lead_%';

create or replace function public.ingest_meta_lead_atomic(
  p_workspace_id uuid, p_leadgen_id text, p_page_id text, p_form_id text,
  p_canonical_name text, p_country text, p_city text, p_profile_data jsonb,
  p_evidence_data jsonb, p_content_hash text, p_expires_at timestamptz
)
returns table (duplicate boolean, prospect_id uuid, evidence_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  v_existing_id uuid; v_company_id uuid; v_prospect_id uuid; v_evidence_id uuid;
begin
  select id into v_existing_id from public.prospect_evidence
  where workspace_id = p_workspace_id and evidence_key = 'meta_lead_' || p_leadgen_id limit 1;
  if v_existing_id is not null then
    select prospect_id into v_prospect_id from public.prospect_evidence where id = v_existing_id;
    return query select true, v_prospect_id, v_existing_id; return;
  end if;

  insert into public.companies (name, industry, country, workspace_id)
  values (left(coalesce(nullif(trim(p_canonical_name), ''), 'Meta Lead ' || p_leadgen_id), 240), 'Unknown', coalesce(nullif(trim(p_country), ''), 'Unknown'), p_workspace_id)
  returning id into v_company_id;

  insert into public.prospect_profiles (
    company_id, canonical_name, industry, country, city, lifecycle_status, profile_data, workspace_id
  ) values (
    v_company_id,
    left(coalesce(nullif(trim(p_canonical_name), ''), 'Meta Lead ' || p_leadgen_id), 240),
    'Unknown', nullif(trim(p_country), ''), nullif(trim(p_city), ''), 'discovered',
    coalesce(p_profile_data, '{}'::jsonb) || jsonb_build_object('meta_leadgen_id', p_leadgen_id, 'meta_page_id', p_page_id, 'meta_form_id', p_form_id),
    p_workspace_id
  ) returning id into v_prospect_id;

  insert into public.prospect_evidence (
    prospect_id, evidence_type, source_type, source_name, claim, evidence_data, confidence,
    expires_at, evidence_key, evidence_status, extractor, observed_at, content_hash, workspace_id
  ) values (
    v_prospect_id, 'meta_lead_ad', 'private', 'Meta Lead Ads',
    'Meta Lead Ads submission received for the authorized ZA Media connection.',
    coalesce(p_evidence_data, '{}'::jsonb), 1, p_expires_at, 'meta_lead_' || p_leadgen_id,
    'active', 'meta-lead-ingest/v1', now(), p_content_hash, p_workspace_id
  ) returning id into v_evidence_id;

  insert into public.audit_logs (action, entity_type, entity_id, actor, details, workspace_id)
  values ('meta_lead_ingested', 'prospect_evidence', v_evidence_id, 'meta-lead-ingest',
    jsonb_build_object('leadgen_id', p_leadgen_id, 'page_id', p_page_id, 'form_id', p_form_id, 'prospect_id', v_prospect_id, 'content_hash', p_content_hash),
    p_workspace_id);

  return query select false, v_prospect_id, v_evidence_id;
exception when unique_violation then
  select id into v_existing_id from public.prospect_evidence
  where workspace_id = p_workspace_id and evidence_key = 'meta_lead_' || p_leadgen_id limit 1;
  if v_existing_id is null then raise; end if;
  select prospect_id into v_prospect_id from public.prospect_evidence where id = v_existing_id;
  return query select true, v_prospect_id, v_existing_id;
end;
$$;

revoke all on function public.ingest_meta_lead_atomic(uuid,text,text,text,text,text,text,jsonb,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_meta_lead_atomic(uuid,text,text,text,text,text,text,jsonb,jsonb,text,timestamptz) to service_role;