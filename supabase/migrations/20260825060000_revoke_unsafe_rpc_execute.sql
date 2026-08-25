-- Keep legacy/internal functions available to trusted server code, but never expose them through PostgREST.
DO $$
BEGIN
  IF to_regprocedure('public.commit_import_batch(jsonb,jsonb,jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.commit_import_batch(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.create_lead_with_audit(uuid,uuid,text,text,text,text,text,numeric,numeric,public.lead_source,text,text,uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_lead_with_audit(uuid, uuid, text, text, text, text, text, numeric, numeric, public.lead_source, text, text, uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.is_organization_member(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.rollback_import_batch(text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rollback_import_batch(text, text) FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;
