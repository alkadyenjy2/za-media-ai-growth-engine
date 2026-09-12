-- Tenant-scope legacy operational tables that directly belong to leads.

ALTER TABLE public.automation_events ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.follow_up_workflows ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.pipeline_stage_history ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.automation_events a SET workspace_id = l.workspace_id FROM public.leads l WHERE a.lead_id = l.id AND a.workspace_id IS NULL;
UPDATE public.follow_up_workflows f SET workspace_id = l.workspace_id FROM public.leads l WHERE f.lead_id = l.id AND f.workspace_id IS NULL;
UPDATE public.pipeline_stage_history h SET workspace_id = l.workspace_id FROM public.leads l WHERE h.lead_id = l.id AND h.workspace_id IS NULL;
UPDATE public.tasks t SET workspace_id = l.workspace_id FROM public.leads l WHERE t.related_lead_id = l.id AND t.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_automation_events_workspace_id ON public.automation_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_workflows_workspace_id ON public.follow_up_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_workspace_id ON public.pipeline_stage_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON public.tasks(workspace_id);

CREATE OR REPLACE FUNCTION public.set_lead_derived_workspace()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE expected_workspace uuid;
BEGIN
  IF TG_TABLE_NAME = 'automation_events' THEN SELECT workspace_id INTO expected_workspace FROM public.leads WHERE id = NEW.lead_id;
  ELSIF TG_TABLE_NAME = 'follow_up_workflows' THEN SELECT workspace_id INTO expected_workspace FROM public.leads WHERE id = NEW.lead_id;
  ELSIF TG_TABLE_NAME = 'pipeline_stage_history' THEN SELECT workspace_id INTO expected_workspace FROM public.leads WHERE id = NEW.lead_id;
  ELSE SELECT workspace_id INTO expected_workspace FROM public.leads WHERE id = NEW.related_lead_id;
  END IF;
  IF NEW.workspace_id IS NULL THEN NEW.workspace_id := expected_workspace; END IF;
  IF NEW.workspace_id IS NULL THEN RAISE EXCEPTION 'Lead-derived record must resolve to a workspace' USING errcode = '23502'; END IF;
  IF expected_workspace IS NOT NULL AND NEW.workspace_id <> expected_workspace THEN RAISE EXCEPTION 'Lead-derived workspace mismatch' USING errcode = '42501'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_lead_derived_workspace() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS automation_events_workspace_guard ON public.automation_events;
CREATE TRIGGER automation_events_workspace_guard BEFORE INSERT OR UPDATE ON public.automation_events FOR EACH ROW EXECUTE FUNCTION public.set_lead_derived_workspace();
DROP TRIGGER IF EXISTS follow_up_workflows_workspace_guard ON public.follow_up_workflows;
CREATE TRIGGER follow_up_workflows_workspace_guard BEFORE INSERT OR UPDATE ON public.follow_up_workflows FOR EACH ROW EXECUTE FUNCTION public.set_lead_derived_workspace();
DROP TRIGGER IF EXISTS pipeline_stage_history_workspace_guard ON public.pipeline_stage_history;
CREATE TRIGGER pipeline_stage_history_workspace_guard BEFORE INSERT OR UPDATE ON public.pipeline_stage_history FOR EACH ROW EXECUTE FUNCTION public.set_lead_derived_workspace();
DROP TRIGGER IF EXISTS tasks_workspace_guard ON public.tasks;
CREATE TRIGGER tasks_workspace_guard BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_lead_derived_workspace();

ALTER TABLE public.automation_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.follow_up_workflows ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.pipeline_stage_history ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN workspace_id SET NOT NULL;

DO $$
DECLARE t text; r record;
BEGIN
  FOREACH t IN ARRAY ARRAY['automation_events','follow_up_workflows','pipeline_stage_history','tasks'] LOOP
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)))', t||'_workspace_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_member(workspace_id)))', t||'_workspace_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id))) WITH CHECK ((SELECT public.is_workspace_member(workspace_id)))', t||'_workspace_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.is_workspace_member(workspace_id)))', t||'_workspace_delete', t);
  END LOOP;
END $$;
