-- Restore the authenticated RLS policy intended by the CRM hardening migration.
-- ai_actions is a legacy, non-tenant-scoped table; keep it out of anonymous access
-- while preserving existing authenticated application behavior.
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_actions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_actions TO authenticated;

DROP POLICY IF EXISTS ai_actions_authenticated_access ON public.ai_actions;
CREATE POLICY ai_actions_authenticated_access
  ON public.ai_actions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
