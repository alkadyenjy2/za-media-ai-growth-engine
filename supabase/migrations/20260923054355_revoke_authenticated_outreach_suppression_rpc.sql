-- The outreach suppression RPC is an internal service-role helper used by the AgentMail sender.
-- Authenticated clients do not need direct RPC access; removing it closes the exposed SECURITY DEFINER surface.
REVOKE EXECUTE ON FUNCTION public.is_outreach_suppressed(uuid, text) FROM authenticated;
