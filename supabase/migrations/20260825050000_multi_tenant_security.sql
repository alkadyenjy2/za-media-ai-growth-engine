-- ZA Media: multi-tenant isolation and production security hardening.
-- This migration is additive. It does not drop data or recreate the database.

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS organization_memberships_user_idx
  ON public.organization_memberships(user_id, organization_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.ai_qualification_scores ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.pipeline_stage_history ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.automation_events ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.follow_up_workflows ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.content_assets ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.content_posts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.ai_actions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.income_records ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.mentor_relationships ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_products ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_customers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_orders ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_order_items ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_subscriptions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_deliveries ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.digital_coupons ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
ALTER TABLE public.discovery_runs ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'automation',
  lead_name text NOT NULL DEFAULT 'System',
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_org_created_idx
  ON public.audit_logs(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_org_member(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.organization_id = target_organization_id
      AND m.user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  base_name text;
  base_slug text;
BEGIN
  base_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1), 'ZA Media Workspace');
  base_slug := regexp_replace(lower(base_name), '[^a-z0-9]+', '-', 'g') || '-' || substr(NEW.id::text, 1, 8);

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (base_name || '''s Workspace', base_slug, NEW.id)
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  INSERT INTO public.user_profiles (id, email, full_name, role, organization_id)
  VALUES (NEW.id, NEW.email, base_name, 'executive', new_org_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    organization_id = COALESCE(public.user_profiles.organization_id, EXCLUDED.organization_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_za_media ON auth.users;
CREATE TRIGGER on_auth_user_created_za_media
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'user_profiles','companies','contacts','leads','ai_qualification_scores',
    'pipeline_stage_history','automation_events','follow_up_workflows',
    'content_assets','content_posts','ai_actions','income_records','tasks',
    'goals','products','community_posts','mentor_relationships','audit_logs',
    'digital_products','digital_customers','digital_orders','digital_order_items',
    'digital_subscriptions','digital_deliveries','digital_coupons','discovery_runs'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (public.is_org_member(organization_id))', t);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "organization_member_select" ON public.organization_memberships;
CREATE POLICY "organization_member_select" ON public.organization_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "organization_select" ON public.organizations;
CREATE POLICY "organization_select" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id));

REVOKE EXECUTE ON FUNCTION public.commit_import_batch(jsonb, jsonb, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rollback_import_batch(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
ALTER FUNCTION public.update_timestamp_column() SET search_path = public;

-- Reference data is read-only for signed-in application users.
DROP POLICY IF EXISTS "reference_select_authenticated" ON public.verticals;
CREATE POLICY "reference_select_authenticated" ON public.verticals FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "reference_select_authenticated" ON public.countries;
CREATE POLICY "reference_select_authenticated" ON public.countries FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS "reference_select_authenticated" ON public.lead_sources;
CREATE POLICY "reference_select_authenticated" ON public.lead_sources FOR SELECT TO authenticated USING (is_active = true);

-- Import tables remain service-role managed only.
DROP POLICY IF EXISTS "service role manages import batches" ON public.sys_import_batches;
CREATE POLICY "service role manages import batches" ON public.sys_import_batches FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service role manages import records" ON public.sys_import_records;
CREATE POLICY "service role manages import records" ON public.sys_import_records FOR ALL TO service_role USING (true) WITH CHECK (true);
