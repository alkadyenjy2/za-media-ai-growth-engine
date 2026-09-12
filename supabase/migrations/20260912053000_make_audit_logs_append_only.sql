DROP POLICY IF EXISTS tenant_delete ON public.audit_logs;
DROP POLICY IF EXISTS tenant_update ON public.audit_logs;
REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
