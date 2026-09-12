-- CRM workspace RLS regression checks.
-- Run against the target database; this file is expected to FAIL before the hardening migration.

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM (VALUES ('companies'),('contacts'),('leads'),('income_records')) AS required(table_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = 'workspace_id'
  );

  IF missing_count <> 0 THEN
    RAISE EXCEPTION 'CRM workspace columns missing: %', missing_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('companies','contacts','leads','income_records')
    AND ('public' = ANY(roles) OR 'anon' = ANY(roles) OR qual = 'true' OR with_check = 'true');

  IF bad_count <> 0 THEN
    RAISE EXCEPTION 'Unsafe CRM RLS policies remain: %', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('companies','contacts','leads','income_records')
    AND grantee IN ('anon','public');

  IF bad_count <> 0 THEN
    RAISE EXCEPTION 'Anonymous/public CRM table grants remain: %', bad_count;
  END IF;
END $$;

DO $$
DECLARE
  missing_rls integer;
BEGIN
  SELECT count(*) INTO missing_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('companies','contacts','leads','income_records')
    AND rowsecurity = false;

  IF missing_rls <> 0 THEN
    RAISE EXCEPTION 'CRM tables without RLS: %', missing_rls;
  END IF;
END $$;
