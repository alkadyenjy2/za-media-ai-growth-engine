-- CRM workspace hardening: make operational CRM data tenant-scoped and remove anonymous/global access.

-- Canonical workspace for the existing ZA Media production data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = '37996c28-d9f9-4e5c-895d-692b8a1f23e0'::uuid) THEN
    RAISE EXCEPTION 'Canonical ZA Media workspace is missing';
  END IF;
END $$;

-- Root CRM tables become workspace-owned.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.income_records ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.companies SET workspace_id = '37996c28-d9f9-4e5c-895d-692b8a1f23e0'::uuid WHERE workspace_id IS NULL;
UPDATE public.contacts c SET workspace_id = co.workspace_id FROM public.companies co WHERE c.company_id = co.id AND c.workspace_id IS NULL;
UPDATE public.leads l SET workspace_id = co.workspace_id FROM public.companies co WHERE l.company_id = co.id AND l.workspace_id IS NULL;
UPDATE public.income_records SET workspace_id = '37996c28-d9f9-4e5c-895d-692b8a1f23e0'::uuid WHERE workspace_id IS NULL;

ALTER TABLE public.companies ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.leads ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.income_records ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_companies_workspace_id ON public.companies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id ON public.contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON public.leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_income_records_workspace_id ON public.income_records(workspace_id);

-- Workspace consistency is enforced at the database boundary.
CREATE OR REPLACE FUNCTION public.current_crm_workspace_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  result uuid;
  member_count integer;
BEGIN
  IF caller IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*), min(workspace_id) INTO member_count, result
  FROM public.workspace_members
  WHERE user_id = caller;

  IF member_count <> 1 THEN
    RAISE EXCEPTION 'CRM access requires exactly one active workspace membership' USING errcode = '42501';
  END IF;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.current_crm_workspace_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_crm_workspace_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_crm_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_workspace uuid;
  expected_workspace uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    caller_workspace := public.current_crm_workspace_id();
  END IF;

  IF TG_TABLE_NAME = 'companies' OR TG_TABLE_NAME = 'income_records' THEN
    IF NEW.workspace_id IS NULL THEN
      NEW.workspace_id := caller_workspace;
    END IF;
  ELSIF TG_TABLE_NAME = 'contacts' THEN
    SELECT workspace_id INTO expected_workspace FROM public.companies WHERE id = NEW.company_id;
    IF expected_workspace IS NULL THEN
      RAISE EXCEPTION 'Contact company must belong to a workspace';
    END IF;
    IF NEW.workspace_id IS NULL THEN NEW.workspace_id := expected_workspace; END IF;
    IF NEW.workspace_id <> expected_workspace THEN
      RAISE EXCEPTION 'Contact workspace must match company workspace' USING errcode = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'leads' THEN
    SELECT workspace_id INTO expected_workspace FROM public.companies WHERE id = NEW.company_id;
    IF expected_workspace IS NULL THEN
      RAISE EXCEPTION 'Lead company must belong to a workspace';
    END IF;
    IF NEW.workspace_id IS NULL THEN NEW.workspace_id := expected_workspace; END IF;
    IF NEW.workspace_id <> expected_workspace THEN
      RAISE EXCEPTION 'Lead workspace must match company workspace' USING errcode = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = NEW.contact_id AND c.company_id = NEW.company_id AND c.workspace_id = NEW.workspace_id) THEN
      RAISE EXCEPTION 'Lead contact must belong to the same company and workspace' USING errcode = '42501';
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL AND NEW.workspace_id <> caller_workspace THEN
    RAISE EXCEPTION 'Workspace does not belong to authenticated user' USING errcode = '42501';
  END IF;
  IF NEW.workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id is required' USING errcode = '23502';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_crm_workspace() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS companies_workspace_guard ON public.companies;
CREATE TRIGGER companies_workspace_guard BEFORE INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_crm_workspace();
DROP TRIGGER IF EXISTS contacts_workspace_guard ON public.contacts;
CREATE TRIGGER contacts_workspace_guard BEFORE INSERT OR UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_crm_workspace();
DROP TRIGGER IF EXISTS leads_workspace_guard ON public.leads;
CREATE TRIGGER leads_workspace_guard BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_crm_workspace();
DROP TRIGGER IF EXISTS income_records_workspace_guard ON public.income_records;
CREATE TRIGGER income_records_workspace_guard BEFORE INSERT OR UPDATE ON public.income_records FOR EACH ROW EXECUTE FUNCTION public.set_crm_workspace();

-- Derivative AI records inherit workspace ownership from their CRM relations.
ALTER TABLE public.ai_audits ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.ai_qualification_scores ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
UPDATE public.ai_audits a SET workspace_id = l.workspace_id FROM public.leads l WHERE a.lead_id = l.id AND a.workspace_id IS NULL;
UPDATE public.ai_audits a SET workspace_id = c.workspace_id FROM public.companies c WHERE a.company_id = c.id AND a.workspace_id IS NULL;
UPDATE public.ai_qualification_scores s SET workspace_id = l.workspace_id FROM public.leads l WHERE s.lead_id = l.id AND s.workspace_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_audits_workspace_id ON public.ai_audits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_qualification_scores_workspace_id ON public.ai_qualification_scores(workspace_id);

CREATE OR REPLACE FUNCTION public.set_ai_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  expected_workspace uuid;
BEGIN
  IF TG_TABLE_NAME = 'ai_audits' THEN
    SELECT workspace_id INTO expected_workspace FROM public.leads WHERE id = NEW.lead_id;
    IF expected_workspace IS NULL AND NEW.company_id IS NOT NULL THEN
      SELECT workspace_id INTO expected_workspace FROM public.companies WHERE id = NEW.company_id;
    END IF;
  ELSE
    SELECT workspace_id INTO expected_workspace FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  IF NEW.workspace_id IS NULL THEN NEW.workspace_id := expected_workspace; END IF;
  IF NEW.workspace_id IS NULL THEN RAISE EXCEPTION 'AI record must resolve to a workspace' USING errcode = '23502'; END IF;
  IF expected_workspace IS NOT NULL AND NEW.workspace_id <> expected_workspace THEN
    RAISE EXCEPTION 'AI record workspace must match its CRM relation' USING errcode = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_ai_workspace() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ai_audits_workspace_guard ON public.ai_audits;
CREATE TRIGGER ai_audits_workspace_guard BEFORE INSERT OR UPDATE ON public.ai_audits FOR EACH ROW EXECUTE FUNCTION public.set_ai_workspace();
DROP TRIGGER IF EXISTS ai_qualification_scores_workspace_guard ON public.ai_qualification_scores;
CREATE TRIGGER ai_qualification_scores_workspace_guard BEFORE INSERT OR UPDATE ON public.ai_qualification_scores FOR EACH ROW EXECUTE FUNCTION public.set_ai_workspace();
ALTER TABLE public.ai_audits ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.ai_qualification_scores ALTER COLUMN workspace_id SET NOT NULL;

-- Replace unsafe CRM policies completely.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN ('companies','contacts','leads','income_records','ai_audits','ai_qualification_scores') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','contacts','leads','income_records','ai_audits','ai_qualification_scores'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;

CREATE POLICY crm_companies_select ON public.companies FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_companies_insert ON public.companies FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_companies_update ON public.companies FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_companies_delete ON public.companies FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));

CREATE POLICY crm_contacts_select ON public.contacts FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_contacts_insert ON public.contacts FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)) AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.workspace_id = contacts.workspace_id));
CREATE POLICY crm_contacts_update ON public.contacts FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)) AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.workspace_id = contacts.workspace_id));
CREATE POLICY crm_contacts_delete ON public.contacts FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));

CREATE POLICY crm_leads_select ON public.leads FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_leads_insert ON public.leads FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)) AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.workspace_id = leads.workspace_id) AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.company_id = leads.company_id AND c.workspace_id = leads.workspace_id));
CREATE POLICY crm_leads_update ON public.leads FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)) AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.workspace_id = leads.workspace_id) AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = contact_id AND c.company_id = leads.company_id AND c.workspace_id = leads.workspace_id));
CREATE POLICY crm_leads_delete ON public.leads FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));

CREATE POLICY crm_income_select ON public.income_records FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_income_insert ON public.income_records FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_income_update ON public.income_records FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY crm_income_delete ON public.income_records FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));

CREATE POLICY ai_audits_select ON public.ai_audits FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY ai_audits_insert ON public.ai_audits FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY ai_audits_update ON public.ai_audits FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY ai_audits_delete ON public.ai_audits FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));

CREATE POLICY ai_scores_select ON public.ai_qualification_scores FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY ai_scores_insert ON public.ai_qualification_scores FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY ai_scores_update ON public.ai_qualification_scores FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY ai_scores_delete ON public.ai_qualification_scores FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)));

-- Remove anonymous access from the remaining legacy operational tables.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' AND roles = '{public}'::name[] AND tablename IN ('ai_actions','automation_events','community_posts','content_assets','follow_up_workflows','goals','mentor_relationships','pipeline_stage_history','products','tasks','user_profiles') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ai_actions','automation_events','community_posts','content_assets','follow_up_workflows','goals','mentor_relationships','pipeline_stage_history','products','tasks','user_profiles'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t||'_authenticated_access', t);
  END LOOP;
END $$;

-- Existing audit workspace trigger now also derives service-role audit rows from CRM entities.
CREATE OR REPLACE FUNCTION public.set_audit_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE resolved_workspace uuid;
BEGIN
  IF NEW.workspace_id IS NULL AND NEW.entity_id IS NOT NULL THEN
    IF NEW.entity_type = 'company' THEN SELECT workspace_id INTO resolved_workspace FROM public.companies WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'contact' THEN SELECT workspace_id INTO resolved_workspace FROM public.contacts WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'lead' THEN SELECT workspace_id INTO resolved_workspace FROM public.leads WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'income_record' THEN SELECT workspace_id INTO resolved_workspace FROM public.income_records WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'ai_audit' THEN SELECT workspace_id INTO resolved_workspace FROM public.ai_audits WHERE id = NEW.entity_id;
    END IF;
    NEW.workspace_id := resolved_workspace;
  END IF;
  IF NEW.workspace_id IS NULL AND auth.uid() IS NOT NULL THEN NEW.workspace_id := public.current_crm_workspace_id(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_logs_workspace_default ON public.audit_logs;
CREATE TRIGGER audit_logs_workspace_default BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_audit_workspace();
REVOKE ALL ON FUNCTION public.set_audit_workspace() FROM PUBLIC, anon, authenticated;

-- Harden the bootstrap helper: callers use create_workspace_with_owner for the canonical slug.
REVOKE ALL ON FUNCTION public.claim_unowned_workspace(uuid) FROM PUBLIC, anon, authenticated;

-- Existing frontend calls create_workspace_with_owner; keep it authenticated-only.
REVOKE ALL ON FUNCTION public.create_workspace_with_owner(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text,text) TO authenticated;
