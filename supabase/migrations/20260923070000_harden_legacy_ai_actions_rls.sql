-- Resolve the Supabase RLS lint on the unused legacy ai_actions table.
-- The canonical ZA Media application does not reference this legacy table.
-- Keep RLS enabled and explicitly deny API access until a workspace-scoped
-- replacement is introduced.
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_actions_no_access ON public.ai_actions;
CREATE POLICY ai_actions_no_access
  ON public.ai_actions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
REVOKE ALL ON TABLE public.ai_actions FROM anon;
REVOKE ALL ON TABLE public.ai_actions FROM authenticated;
