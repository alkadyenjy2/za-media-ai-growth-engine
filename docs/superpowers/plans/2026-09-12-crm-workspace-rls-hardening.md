# CRM Workspace RLS Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

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

### Task 1: Establish security regression checks — COMPLETE
- [x] SQL regression assertions created in `supabase/tests/crm_workspace_rls.sql`.
- [x] RED verified against the pre-hardening production state.
- [x] GREEN verified after the production migrations.

### Task 2: Add workspace boundary migration — COMPLETE
- [x] Added and backfilled CRM `workspace_id` columns.
- [x] Added membership-aware CRM RLS, grants, indexes, and consistency guards.
- [x] Applied `20260912050000_crm_workspace_rls_hardening` to production.

### Task 3: Secure derivative and operational data — COMPLETE
- [x] AI audit/qualification rows are workspace-scoped.
- [x] Lead-derived automation/follow-up/pipeline/task rows are workspace-scoped.
- [x] Audit logs are append-only for authenticated users.
- [x] Workspace SECURITY DEFINER helpers were hardened; unused claim RPC execution was removed.

### Task 4: Align frontend contracts — COMPLETE
- [x] CRM TypeScript models include `workspace_id`.
- [x] Workspace bootstrap now uses the canonical `create_workspace_with_owner` RPC.
- [x] Removed stale `social_pages` UI because that production table does not exist.

### Task 5: Release verification — COMPLETE / FINAL AUDIT HANDOFF
- [x] No `anon` table grants remain in `public`.
- [x] No `public`/`anon` RLS policies remain.
- [x] CRM and derived operational policies are authenticated + workspace-aware.
- [x] Existing CRM rows are fully assigned to ZA Media.
- [x] Transactional Company → Contact → Lead + Income test passed and was rolled back.
- [x] Service-role key references are confined to server-side Edge Functions in repository search.
- [x] CI passed on the hardening branch before the final docs-only commit; the final commit contains only documentation changes.
- [ ] Independent Arena verification remains the final external release gate.
