-- Keep SECURITY DEFINER helpers outside the exposed public API schema.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.is_org_member(target_organization_id uuid)
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
REVOKE ALL ON FUNCTION private.is_org_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.handle_new_user()
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
REVOKE ALL ON FUNCTION private.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_za_media ON auth.users;
CREATE TRIGGER on_auth_user_created_za_media
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.handle_new_user();

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
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "tenant_select" ON public.%I FOR SELECT TO authenticated USING (private.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "tenant_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "tenant_update" ON public.%I FOR UPDATE TO authenticated USING (private.is_org_member(organization_id)) WITH CHECK (private.is_org_member(organization_id))', t);
    EXECUTE format('CREATE POLICY "tenant_delete" ON public.%I FOR DELETE TO authenticated USING (private.is_org_member(organization_id))', t);
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS "organization_select" ON public.organizations;
CREATE POLICY "organization_select" ON public.organizations
  FOR SELECT TO authenticated USING (private.is_org_member(id));

DROP FUNCTION IF EXISTS public.is_org_member(uuid);
DROP FUNCTION IF EXISTS public.handle_new_user();
