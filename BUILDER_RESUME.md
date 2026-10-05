# Builder Resume Handoff

Purpose: resume ZA Media without rebuilding or consuming generation/build credits unnecessarily.

Canonical branch: main
Last GitHub HEAD audited: 3df2b1ca63e8ef8278571d2c8718048c650954d4
Stack: React/Vite + Convex only.

Rules:
- Convex is the only runtime database/backend. Do not add Supabase runtime.
- Preserve production outbound freeze until real Meta activation/evidence exists.
- No fake leads, Meta events, webhooks, outreach, or analytics.
- Keep evidence gate and HMAC/signature verification.
- Run typecheck/build before builder changes.
- Real Meta credentials/dashboard activation remain external blockers.
- Commit verified code changes to this repo before spending builder credits.

Next builder action: verify current CI/build and inspect only reproducible code-level failures.
