# CRM Workspace RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ZA Media CRM data genuinely workspace-scoped and remove the current public `ALL` RLS exposure without changing the P0 AI engines.

**Architecture:** Add `workspace_id` to the four CRM root tables (`companies`, `contacts`, `leads`, `income_records`) and backfill all existing CRM rows to the canonical ZA Media workspace. Enforce membership-aware RLS for authenticated users, derive missing workspace IDs safely from the caller's sole membership for dashboard inserts, and preserve explicit workspace IDs for trusted server-side workflows. Secure derivative AI/audit tables through their existing workspace relationships rather than inventing new P0 behavior.

**Tech Stack:** Supabase Postgres/RLS, Supabase JS, Vite + React + TypeScript, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-11-supabase-auth-workspace-boundary-design.md`

## Global Constraints

- Canonical repo: `alkadyenjy2/za-media-ai-growth-engine`, branch `main`.
- Canonical Supabase project: `kipkdfydajlqsoaslhuv`.
- Canonical workspace: `37996c28-d9f9-4e5c-895d-692b8a1f23e0` (`za-media`).
- Never expose or move `SUPABASE_SERVICE_ROLE_KEY` to client code.
- Never weaken RLS to make the dashboard work.
- Never recreate or alter P0 AI algorithms/engines.
- Never introduce a second database or restore n8n as a runtime dependency.
- Preserve existing production CRM data and IDs.

---

### Task 1: Establish security regression checks

**Files:**
- Create: `supabase/tests/crm_workspace_rls.sql`

**Interfaces:**
- Consumes: production table/function metadata.
- Produces: deterministic SQL assertions that fail when CRM workspace columns, policies, or grants regress.

- [ ] Step 1: Write SQL assertions for required `workspace_id` columns, RLS enabled, absence of `public`/`anon` table grants, and membership-aware policies.
- [ ] Step 2: Run the assertions against the current production database and confirm they fail for the known public `ALL true` policies.
- [ ] Step 3: Keep the assertions as the post-migration security regression suite.

### Task 2: Add workspace boundary migration

**Files:**
- Create: `supabase/migrations/20260912050000_crm_workspace_rls_hardening.sql`

**Interfaces:**
- Consumes: canonical workspace ID and existing company/contact/lead/income rows.
- Produces: workspace-scoped CRM tables and policies.

- [ ] Step 1: Add nullable `workspace_id` columns with FK to `workspaces`.
- [ ] Step 2: Backfill existing rows to the canonical ZA Media workspace.
- [ ] Step 3: Add indexes and FKs from contacts/leads to preserve workspace consistency.
- [ ] Step 4: Add a SECURITY DEFINER helper that resolves the caller's unique workspace and rejects ambiguous/no-membership writes.
- [ ] Step 5: Add insert triggers that fill missing `workspace_id` for authenticated dashboard inserts and reject cross-workspace writes.
- [ ] Step 6: Replace public `ALL true` policies on CRM tables with authenticated membership-aware SELECT/INSERT/UPDATE/DELETE policies.
- [ ] Step 7: Add consistency policies so contacts/leads must use their company's workspace.
- [ ] Step 8: Revoke table access from `anon` and grant only the required authenticated table privileges.
- [ ] Step 9: Apply migration to production.
- [ ] Step 10: Run the security regression SQL and production CRUD acceptance checks.

### Task 3: Secure derivative AI and audit data

**Files:**
- Modify: `supabase/migrations/20260912050000_crm_workspace_rls_hardening.sql`

**Interfaces:**
- Consumes: workspace-scoped CRM rows.
- Produces: tenant-aware access for `ai_audits` and `ai_qualification_scores`; preserves service-role Edge Function writes.

- [ ] Step 1: Add/backfill `workspace_id` where needed using `lead_id`/`company_id` relationships.
- [ ] Step 2: Replace anonymous/global policies with authenticated workspace policies.
- [ ] Step 3: Preserve server-side service-role operation for Edge Functions.
- [ ] Step 4: Verify no cross-workspace read/write policy remains.

### Task 4: Align frontend data contracts

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/pages/CompaniesPage.tsx`
- Modify: `src/pages/LeadsPage.tsx`
- Modify: `src/pages/IncomePage.tsx`
- Modify: `src/auth/workspace.ts`

**Interfaces:**
- Consumes: authenticated active workspace.
- Produces: explicit workspace-aware client writes and reads while retaining current UI behavior.

- [ ] Step 1: Add `workspace_id` to CRM TypeScript models.
- [ ] Step 2: Resolve the active workspace once and include its ID in CRM writes.
- [ ] Step 3: Scope CRM reads to the active workspace where useful for defense-in-depth.
- [ ] Step 4: Keep the database as the authorization authority; client filters are not security controls.
- [ ] Step 5: Run typecheck/build.

### Task 5: Full regression and release verification

**Files:**
- Modify only if verification finds a concrete regression.

**Interfaces:**
- Consumes: hardened production DB + current `main` code.
- Produces: release evidence and final GO/NO-GO.

- [ ] Step 1: Verify all CRM tables have RLS enabled and no `public`/`anon` policies/grants.
- [ ] Step 2: Verify SECURITY DEFINER helpers use fixed `search_path`, `auth.uid()`, and restricted execution.
- [ ] Step 3: Verify existing Company → Contact → Lead and Income acceptance data remains intact.
- [ ] Step 4: Verify lead status change and audit log persistence.
- [ ] Step 5: Verify no client-side service-role secret references.
- [ ] Step 6: Run CI typecheck/build on the final branch.
- [ ] Step 7: Prepare final Arena independent verification prompt with exact migration/commit evidence.
