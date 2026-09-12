CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(target_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = target_workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role IN ('owner','admin')
  );
$$;
REVOKE ALL ON FUNCTION public.is_workspace_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(workspace_name text, workspace_slug text)
RETURNS public.workspaces
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  uid uuid := auth.uid();
  existing_workspace public.workspaces;
  result public.workspaces;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode='42501'; END IF;
  IF nullif(trim(workspace_name), '') IS NULL OR nullif(trim(workspace_slug), '') IS NULL THEN
    RAISE EXCEPTION 'Workspace name and slug are required';
  END IF;
  SELECT * INTO existing_workspace FROM public.workspaces WHERE slug = trim(workspace_slug) LIMIT 1;
  IF existing_workspace.id IS NOT NULL THEN
    IF public.is_workspace_member(existing_workspace.id) THEN RETURN existing_workspace; END IF;
    IF EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = existing_workspace.id) THEN
      RAISE EXCEPTION 'Workspace already has members' USING errcode='42501';
    END IF;
    INSERT INTO public.workspace_members(workspace_id,user_id,role)
    VALUES(existing_workspace.id,uid,'owner') ON CONFLICT (workspace_id,user_id) DO NOTHING;
    RETURN existing_workspace;
  END IF;
  INSERT INTO public.workspaces(name,slug,created_by)
  VALUES(trim(workspace_name),trim(workspace_slug),uid) RETURNING * INTO result;
  INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(result.id,uid,'owner');
  RETURN result;
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO existing_workspace FROM public.workspaces WHERE slug = trim(workspace_slug) LIMIT 1;
  IF existing_workspace.id IS NOT NULL AND public.is_workspace_member(existing_workspace.id) THEN RETURN existing_workspace; END IF;
  RAISE EXCEPTION 'Workspace slug already exists';
END;
$$;
REVOKE ALL ON FUNCTION public.create_workspace_with_owner(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text,text) TO authenticated;
