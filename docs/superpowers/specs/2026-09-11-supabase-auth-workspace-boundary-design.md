# Supabase Auth + Workspace Boundary Design

## Status

Approved direction: user approved the architectural approach in chat. This document records the design before implementation.

## Goal

Move the ZA Media dashboard from anonymous/shared access to authenticated, workspace-scoped access while preserving the existing P0 Growth Intelligence behavior and background automation.

## Current State

- The browser Supabase client exists in `src/lib/supabase.ts`, but session persistence is disabled and the app does not currently gate the dashboard on authentication.
- `src/App.tsx` switches directly from the public landing page to the dashboard.
- A tenant foundation migration already created `public.workspaces` and `public.workspace_members`, added nullable `workspace_id` columns to the P0 data tables, backfilled the existing ZA Media rows, and indexed those columns.
- Existing P0 tables still have shared RLS policies that permit anonymous/authenticated access. Tenant isolation is therefore not yet active.
- Edge Functions use server-side credentials and therefore cannot rely on database RLS alone for user authorization; user-invoked functions must validate workspace membership explicitly.

## Architecture

### 1. Authentication boundary

Use Supabase Auth with a browser session persisted by the Supabase JS client.

The public landing page remains accessible without authentication. Entering the operational dashboard requires an authenticated session.

The frontend receives session changes through `supabase.auth.onAuthStateChange` and exposes the current user/session through a small React auth provider rather than scattering auth state across pages.

### 2. Workspace boundary

The first authenticated workspace is the existing `za-media` workspace.

A user is authorized to operate on a workspace only when a row exists in `public.workspace_members` for `auth.uid()` and that workspace.

The frontend resolves the user's workspace membership after authentication and uses the resolved workspace ID for operational queries. The client must not be able to select a different workspace merely by changing a request parameter.

### 3. RLS boundary

Replace the current shared policies on these tables with workspace-scoped policies:

- `prospect_profiles`
- `prospect_evidence`
- `prospect_intent_signals`
- `prospect_opportunities`
- `prospect_service_matches`
- `prospect_outreach_events`
- `meta_connections`
- `meta_prospect_targets`
- `audit_logs`

For reads/updates/deletes, the row's `workspace_id` must belong to the authenticated user.

For inserts/updates, `WITH CHECK` must enforce the same membership condition so a client cannot insert a row into or move a row to another workspace.

Anonymous access to operational tables is removed.

The existing `is_workspace_member(uuid)` security-definer helper remains the central membership predicate. The current admin membership policy is changed to use a dedicated security-definer admin predicate rather than recursively querying `workspace_members` from its own policy.

### 4. Workspace bootstrap

Because a new authenticated user cannot bootstrap their first membership through the current membership-management policy, add a narrowly scoped `create_workspace_with_owner()` security-definer RPC for authenticated users.

The RPC must:

1. Read `auth.uid()`.
2. Reject unauthenticated calls.
3. Create the requested workspace with a unique slug.
4. Insert the current user as `owner`.
5. Return the workspace ID.

For the existing ZA Media workspace, the first authorized user can be provisioned as owner through the same controlled path without exposing unrestricted membership writes.

### 5. Edge Function authorization

User-invoked Edge Functions that read or mutate P0 tenant data must authenticate the JWT and verify workspace membership before performing service-role database operations.

The verification must use the authenticated user's identity, the target prospect's workspace, and/or an explicitly resolved workspace ID. A caller-supplied workspace ID is never treated as sufficient authorization.

Cron/background functions such as prospect monitoring continue using server-side credentials and are not converted to browser authorization flows.

### 6. Frontend data flow

```text
Public Landing Page
        |
        | Dashboard
        v
   Supabase Auth
        |
        | authenticated session
        v
 Workspace Resolver
        |
        | workspace_id
        v
 Dashboard Pages
        |
        +--> workspace-scoped Supabase queries
        |
        +--> JWT-protected Edge Functions
                     |
                     +--> membership check
                     |
                     +--> service-role operation
```

No P0 intelligence algorithm is rewritten as part of this change.

## Components and Files

### Frontend

- `src/lib/supabase.ts` — enable persistent Supabase Auth session handling while preserving the existing public publishable-key configuration.
- `src/auth/AuthProvider.tsx` — own session/user state and auth-state subscription.
- `src/auth/RequireAuth.tsx` — gate operational dashboard routes/views.
- `src/auth/LoginPage.tsx` — minimal ZA Media login screen.
- `src/auth/workspace.ts` — resolve the authenticated user's workspace membership.
- `src/App.tsx` — route the dashboard through authentication and workspace resolution.
- Dashboard data access files — add explicit workspace filtering where queries currently read operational tables without a tenant boundary.

### Database

- `supabase/migrations/<next>_auth_workspace_rls_cutover.sql` — admin helper, bootstrap RPC, replacement workspace-scoped RLS policies, anonymous revoke, and final constraint hardening only after frontend/function compatibility is verified.
- `supabase/tests/` or the repository's established database-test location — RLS authorization tests if the existing CI supports pgTAP/database tests.

### Edge Functions

Audit and update only the user-invoked functions that access tenant-scoped data. Preserve cron/background functions separately.

Priority functions include:

- `intent-engine`
- `scoring-engine`
- `opportunity-engine`
- `service-matching`
- `geo-intelligence`
- `personalized-outreach`
- `website-intelligence`
- `social-intelligence`
- `meta-prospecting`

The implementation should introduce a small shared authorization pattern rather than duplicating inconsistent membership logic across functions.

## Error Handling

- Unauthenticated dashboard access redirects to login.
- Authenticated users with no workspace membership see a clear provisioning state rather than an empty dashboard.
- Requests targeting a workspace the user does not belong to return authorization failure without leaking whether another workspace exists.
- A missing/invalid workspace on a P0 function returns a deterministic 401/403-style response and creates no partial business record.
- Auth session refresh failures return the user to the authentication boundary instead of silently falling back to demo mode.
- The existing local/demo adapter must not be used as an authorization bypass for production dashboard data.

## Testing Strategy

### Static

- TypeScript build/typecheck.
- Verify no browser bundle contains a service-role/secret key.
- Verify operational dashboard components do not intentionally bypass Auth.

### Database authorization

Test at minimum:

1. Anonymous user cannot select operational rows.
2. Authenticated member can select rows from their workspace.
3. Authenticated non-member cannot select another workspace's rows.
4. Member cannot insert with another workspace's ID.
5. Member cannot update a row into another workspace.
6. Member cannot delete another workspace's row.
7. Admin/owner membership operations work without recursive RLS failure.
8. Workspace bootstrap creates exactly one owner membership for the authenticated caller.

### Behavioral

- Login creates a real Supabase session.
- Dashboard is inaccessible before authentication.
- ZA Media member can load existing P0 data.
- Existing prospect/evidence/intent/opportunity/service-match counts remain unchanged.
- User-invoked Edge Functions reject a valid JWT that lacks membership.
- Authorized P0 function execution continues to work.
- Cron monitoring continues to operate independently of browser authentication.

No claim of end-to-end success is made until actual tool/test results demonstrate it.

## Migration Safety

The tenant foundation already exists and remains nullable during the transition. Do not make `workspace_id` NOT NULL or remove compatibility policies until:

1. frontend authentication is wired;
2. all operational dashboard reads/writes use the authenticated boundary;
3. affected Edge Functions perform membership validation;
4. database authorization tests pass;
5. the existing ZA Media production data path has been behaviorally verified.

Only then perform the final RLS cutover and constraint hardening.

## Explicit Non-Goals

- No rewrite of P0 scoring, intent, opportunity, service matching, GEO, or outreach algorithms.
- No migration to another auth provider.
- No CRM migration.
- No n8n reintroduction.
- No uncontrolled outreach execution.
- No fake users, fake leads, or synthetic production evidence.
