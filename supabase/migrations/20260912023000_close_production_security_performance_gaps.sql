-- Tenant-bound GEO assessments
ALTER TABLE public.prospect_geo_assessments ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.prospect_geo_assessments ga SET workspace_id = pp.workspace_id FROM public.prospect_profiles pp WHERE ga.prospect_id = pp.id AND ga.workspace_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_geo_assessments_workspace ON public.prospect_geo_assessments(workspace_id);
ALTER TABLE public.prospect_geo_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_select ON public.prospect_geo_assessments;
DROP POLICY IF EXISTS tenant_insert ON public.prospect_geo_assessments;
DROP POLICY IF EXISTS tenant_update ON public.prospect_geo_assessments;
DROP POLICY IF EXISTS tenant_delete ON public.prospect_geo_assessments;
CREATE POLICY tenant_select ON public.prospect_geo_assessments FOR SELECT TO authenticated USING (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY tenant_insert ON public.prospect_geo_assessments FOR INSERT TO authenticated WITH CHECK (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY tenant_update ON public.prospect_geo_assessments FOR UPDATE TO authenticated USING (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id))) WITH CHECK (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY tenant_delete ON public.prospect_geo_assessments FOR DELETE TO authenticated USING (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
REVOKE ALL ON public.prospect_geo_assessments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_geo_assessments TO authenticated;

-- Close the legacy content_posts RLS no-policy finding by scoping it to the ZA workspace.
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id);
UPDATE public.content_posts SET workspace_id = (SELECT id FROM public.workspaces WHERE slug='za-media') WHERE workspace_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_content_posts_workspace ON public.content_posts(workspace_id);
DROP POLICY IF EXISTS tenant_select ON public.content_posts;
DROP POLICY IF EXISTS tenant_insert ON public.content_posts;
DROP POLICY IF EXISTS tenant_update ON public.content_posts;
DROP POLICY IF EXISTS tenant_delete ON public.content_posts;
CREATE POLICY tenant_select ON public.content_posts FOR SELECT TO authenticated USING (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY tenant_insert ON public.content_posts FOR INSERT TO authenticated WITH CHECK (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY tenant_update ON public.content_posts FOR UPDATE TO authenticated USING (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id))) WITH CHECK (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY tenant_delete ON public.content_posts FOR DELETE TO authenticated USING (workspace_id IS NOT NULL AND (SELECT public.is_workspace_member(workspace_id)));
REVOKE ALL ON public.content_posts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_posts TO authenticated;

-- Remove an unused SECURITY DEFINER RPC from the exposed API surface.
REVOKE ALL ON FUNCTION public.create_workspace_with_owner(text,text) FROM anon, authenticated;

-- Remove duplicate SELECT evaluation on workspace membership policy while preserving admin write access.
DROP POLICY IF EXISTS "workspace admins manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace members read" ON public.workspace_members;
CREATE POLICY "workspace members read" ON public.workspace_members FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id OR (SELECT public.is_workspace_member(workspace_id)));
CREATE POLICY "workspace admins insert" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_workspace_admin(workspace_id)));
CREATE POLICY "workspace admins update" ON public.workspace_members FOR UPDATE TO authenticated USING ((SELECT public.is_workspace_admin(workspace_id))) WITH CHECK ((SELECT public.is_workspace_admin(workspace_id)));
CREATE POLICY "workspace admins delete" ON public.workspace_members FOR DELETE TO authenticated USING ((SELECT public.is_workspace_admin(workspace_id)));

-- Covering indexes for foreign keys flagged by the performance advisor.
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_history_changed_by_user ON public.pipeline_stage_history(changed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_prospect_intent_signals_evidence ON public.prospect_intent_signals(evidence_id);
CREATE INDEX IF NOT EXISTS idx_prospect_opportunities_evidence ON public.prospect_opportunities(evidence_id);
CREATE INDEX IF NOT EXISTS idx_prospect_outreach_events_opportunity ON public.prospect_outreach_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_prospect_service_matches_opportunity ON public.prospect_service_matches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_related_lead ON public.tasks(related_lead_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);

-- Remove duplicate GEO policies created by earlier hardening.
DROP POLICY IF EXISTS "Shared workspace GEO assessments select" ON public.prospect_geo_assessments;
DROP POLICY IF EXISTS "Shared workspace GEO assessments insert" ON public.prospect_geo_assessments;
DROP POLICY IF EXISTS "Shared workspace GEO assessments update" ON public.prospect_geo_assessments;
DROP POLICY IF EXISTS "Shared workspace GEO assessments delete" ON public.prospect_geo_assessments;
