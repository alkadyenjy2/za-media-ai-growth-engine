-- ai_actions is a legacy table with no current GitHub code references and no rows.
-- It has no workspace_id, so do not expose it to authenticated users without a tenant boundary.
-- Keep RLS enabled and remove direct client access; server-side/service-role paths remain available.
DROP POLICY IF EXISTS ai_actions_authenticated_access ON public.ai_actions;
REVOKE ALL ON TABLE public.ai_actions FROM anon, authenticated;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
