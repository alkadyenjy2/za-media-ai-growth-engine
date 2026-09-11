# Supabase Auth + Workspace Boundary Implementation Plan

## Goal

Move the ZA Media dashboard from anonymous/shared access to authenticated, workspace-scoped access without rewriting the existing P0 engines or changing their algorithms. Keep the public landing page public; require a Supabase Auth session for the operational dashboard; resolve the user's workspace from `workspace_members`; enforce the same boundary in browser RLS and user-invoked Edge Functions.

## Current verified state

- `src/lib/supabase.ts` already uses `@supabase/supabase-js`, but explicitly disables session persistence, token refresh, and URL session detection.
- `src/App.tsx` currently keeps a local `website/dashboard` toggle and opens the dashboard without authentication.
- `src/main.tsx` renders `App` directly.
- The tenant foundation migration is already on `main`: `workspaces`, `workspace_members`, `is_workspace_member(...)`, nullable `workspace_id` columns and backfills exist. Tenant RLS cutover is intentionally not active yet.
- Existing P0 data must remain readable during the transition and must not be recreated.
- `package.json` already contains the required Supabase client dependency; no new auth library is required.

## Execution sequence

### Phase 1 — Auth client and session boundary

1. Update `src/lib/supabase.ts`.
   - Keep the existing URL/publishable-key configuration.
   - Enable `persistSession: true`, `autoRefreshToken: true`, and `detectSessionInUrl: true`.
   - Remove the production demo adapter as an authorization bypass. If configuration is missing, surface an explicit configuration state rather than silently presenting a fake operational dashboard.
   - Keep the browser key publishable/anon only; never add service-role or secret keys.

2. Add `src/auth/AuthProvider.tsx`.
   - Load the initial session with `supabase.auth.getSession()`.
   - Subscribe to `supabase.auth.onAuthStateChange`.
   - Expose `{ session, user, loading, signIn, signUp, signOut }`.
   - Use email/password auth because it requires no additional OAuth provider configuration and is deterministic for the first workspace user.

3. Add `src/auth/RequireAuth.tsx`.
   - Show a small loading boundary while session state is resolving.
   - If there is no session, render the auth screen instead of the dashboard.
   - Never expose dashboard data before the session is established.

4. Add `src/auth/LoginPage.tsx`.
   - Provide email/password sign-in and first-user sign-up in the same controlled surface.
   - Display Supabase auth errors without leaking database details.
   - After successful sign-up/sign-in, hand control back to the workspace resolver.

5. Add `src/auth/workspace.ts`.
   - Resolve the active workspace from `workspace_members` for `auth.uid()`.
   - Prefer the `za-media` workspace when the user belongs to it; otherwise use the first membership deterministically.
   - Do not trust a workspace ID supplied by the browser without membership verification.

6. Update `src/App.tsx` and `src/main.tsx`.
   - Wrap the app with `AuthProvider`.
   - Keep `LandingPage` public.
   - Gate the dashboard through `RequireAuth`.
   - Replace the local dashboard entry bypass with an authenticated transition.
   - Pass the resolved workspace context to the dashboard shell without changing individual P0 page algorithms yet.

### Phase 2 — Workspace bootstrap and database authorization

7. Add a migration under `supabase/migrations/` for the final auth boundary.
   - Add a security-definer `create_workspace_with_owner(workspace_name, workspace_slug)` RPC for authenticated users.
   - It creates the workspace and owner membership atomically.
   - Prevent duplicate ownership/bootstrap races with the existing unique slug and membership keys.
   - Replace the recursive `workspace_members` admin policy with a security-definer helper such as `is_workspace_admin(target_workspace_id)`.
   - Keep `workspace_id` nullable for one transition migration only; do not set NOT NULL until application writes are verified.

8. Replace shared policies on:
   - `prospect_profiles`
   - `prospect_evidence`
   - `prospect_intent_signals`
   - `prospect_opportunities`
   - `prospect_service_matches`
   - `prospect_outreach_events`
   - `meta_connections`
   - `meta_prospect_targets`
   - `audit_logs`

   Policy contract:
   - `authenticated` only; remove anon access.
   - SELECT/UPDATE/DELETE require `is_workspace_member(workspace_id)`.
   - INSERT/UPDATE `WITH CHECK` requires workspace membership.
   - Users cannot insert/update rows into a workspace they do not belong to.
   - Do not grant browser access to service-role credentials.

9. Add database authorization tests for:
   - unauthenticated access denied;
   - member can read own workspace rows;
   - member cannot read another workspace;
   - member can insert/update only in own workspace;
   - cross-workspace update/delete denied;
   - owner/admin membership operations work;
   - existing ZA Media rows remain accessible to its members.

### Phase 3 — Workspace-aware frontend data flow

10. Audit all dashboard queries and Edge Function invocations.
    - Add a single workspace context source rather than scattering workspace lookup logic.
    - Ensure browser queries are naturally constrained by RLS and, where practical, include `workspace_id` filters for explicitness and query locality.
    - Do not create duplicate data-access layers for existing P0 pages unless needed for authorization.

11. Update user-invoked Edge Functions first:
    - `intent-engine`
    - `scoring-engine`
    - `opportunity-engine`
    - `service-matching`
    - `geo-intelligence`
    - `personalized-outreach`
    - `website-intelligence`
    - `social-intelligence`
    - `meta-prospecting`

    For each function:
    - retain JWT verification;
    - derive the caller identity from the verified JWT, not a body field;
    - resolve the requested prospect/workspace;
    - verify the caller is a member of that workspace before any service-role read/write;
    - reject unauthorized workspace access with 401/403 without revealing whether another workspace's record exists;
    - preserve current P0 business logic and output schemas.

12. Keep background/cron functions server-side:
    - `monitor-prospects` continues to run through the existing scheduled path.
    - Background functions may use server credentials, but must explicitly carry the workspace ID through internal operations and never accept an arbitrary user workspace from public input.

### Phase 4 — Workspace-aware dashboard bootstrap

13. Add an authenticated workspace bootstrap state.
    - If a new authenticated user has no membership, call `create_workspace_with_owner()` only through the intended bootstrap UI path.
    - For the existing ZA Media workspace, do not create a duplicate workspace.
    - The existing ZA Media production data remains attached to workspace ID `37996c28-d9f9-4e5c-895d-692b8a1f23e0`.

14. Add minimal dashboard session controls.
    - Show authenticated user identity where the existing layout has an appropriate location.
    - Provide sign-out.
    - Do not redesign the dashboard.

### Phase 5 — Verification and cutover

15. Static verification.
    - Run TypeScript build/typecheck through the repository CI path.
    - Search the client bundle source for `SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, secret keys, and other backend-only credentials.
    - Confirm no production path falls back to the old demo adapter to bypass auth.

16. Database verification.
    - Apply the migration to Supabase.
    - Query policy definitions and workspace counts.
    - Verify the existing ZA Media P0 counts remain: 1 prospect, 3 evidence rows, 1 intent signal, 1 opportunity, 1 service match.

17. Behavioral verification.
    - If a real authenticated user can be provisioned through the connected Supabase tooling, run login → workspace resolution → dashboard data read → one representative P0 function authorization test.
    - Otherwise report the exact external provisioning blocker; do not fabricate a login or claim E2E success.
    - Verify an unauthorized workspace request is rejected.

18. Final hardening only after the above passes.
    - Make `workspace_id` NOT NULL on the tenant tables where every write path is proven workspace-aware.
    - Remove remaining compatibility/shared policies.
    - Revoke anonymous table/function access where no longer required.
    - Keep public landing routes public.

## Files expected to change

### Frontend
- `src/lib/supabase.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/auth/AuthProvider.tsx` (new)
- `src/auth/RequireAuth.tsx` (new)
- `src/auth/LoginPage.tsx` (new)
- `src/auth/workspace.ts` (new)
- Existing dashboard data-access files only where the audit identifies an actual workspace write/read path that needs an explicit context.

### Database
- New auth/workspace hardening migration under `supabase/migrations/`.
- DB authorization tests in the repository's existing test location if one exists; otherwise add a focused SQL test artifact without introducing a new testing framework.

### Edge Functions
- Only functions that perform user-invoked service-role operations and lack workspace authorization after audit. No algorithmic P0 rewrite.

## Safety constraints

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or any secret key to the browser.
- Never use a client-supplied workspace ID as sufficient authorization.
- Never recreate or synthesize the existing ZA Media P0 records.
- Never weaken RLS to make a frontend error disappear.
- Never claim behavioral E2E success from static inspection.
- Do not modify outreach sending behavior; personalized outreach remains draft-only and human-approved.
- Do not change the current P0 scoring/opportunity/service-matching algorithms.

## Acceptance criteria

1. Public landing page remains accessible without authentication.
2. Dashboard cannot render operational data without a valid Supabase session.
3. Authenticated ZA Media workspace members can read existing P0 data.
4. A member cannot read/write another workspace's rows.
5. Anonymous access to tenant data is denied.
6. User-invoked Edge Functions reject cross-workspace requests before service-role data access.
7. Cron monitoring continues to run independently of browser authentication.
8. Existing ZA Media P0 data counts and relationships are unchanged.
9. No secret/service-role credential reaches frontend source or build output.
10. Build/typecheck and database authorization checks provide recent tool evidence before any success claim.

## Execution mode

Recommended: implement this plan in an isolated Git branch, run verification, then open a PR for review before merging. Do not deploy the final RLS cutover until the behavioral authorization checks pass.
