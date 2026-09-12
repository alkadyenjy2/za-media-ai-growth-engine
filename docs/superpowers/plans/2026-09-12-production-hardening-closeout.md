# Production Hardening Closeout

Date: 2026-09-12

## Verified and applied

- Tenant-scoped GEO assessments via `workspace_id` and RLS.
- Tenant-scoped legacy `content_posts` access via `workspace_id` and RLS.
- Removed exposed execute access for unused `create_workspace_with_owner` SECURITY DEFINER RPC.
- Split workspace membership read/write policies to avoid duplicate permissive SELECT evaluation.
- Added covering indexes for flagged foreign keys.
- Removed duplicate GEO RLS policies.
- Auth signup UI now distinguishes a likely existing account from a newly created unconfirmed account.

## Human-only production configuration remaining

Supabase Dashboard configuration is still required for leaked-password protection and production custom SMTP. These settings are not exposed through the connected Supabase management actions available to the assistant. Supabase recommends custom SMTP for production and leaked-password protection for compromised-password defense.

No claim of behavioral end-to-end authentication testing is made without a real user credential and a deliverable email path.
