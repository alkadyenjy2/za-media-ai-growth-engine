-- Source-control reconciliation for live security/performance hardening.
-- These statements are idempotent because the corresponding hardening was
-- already applied to the canonical Supabase project before being committed
-- to GitHub.
CREATE INDEX IF NOT EXISTS idx_prospect_priority_decisions_policy_version
  ON public.prospect_priority_decisions(policy_version);

ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_actions_no_access ON public.ai_actions;
CREATE POLICY ai_actions_no_access
  ON public.ai_actions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
REVOKE ALL ON TABLE public.ai_actions FROM anon, authenticated;
