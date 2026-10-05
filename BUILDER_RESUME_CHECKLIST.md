# Builder Resume Checklist

Status: LOW-CREDIT / EXTERNAL ACTIVATION BLOCKED

Canonical runtime: Convex ONLY. Production outbound is frozen. Do not introduce Supabase runtime or fake Meta events/leads.
Production webhook: qualified-nightingale-421.eu-west-1.convex.site/meta-webhook.

When credits return:
1. Pull/sync main and inspect the latest low-credit state file.
2. Run existing CI/tests before edits.
3. Fix code-level defects only.
4. Keep PRODUCTION_OUTBOUND_FROZEN=true until real Meta credentials/activation are verified.
5. Never fabricate Meta app secret, verify token, page token, leads, webhooks, or outreach.
6. Verify deployment + CI after any change.
7. Commit every confirmed change to GitHub.

Definition of done: code/CI green; real Meta activation either verified with evidence or explicitly marked BLOCKED.