# Builder Handoff — ZA Media
Canonical repo: alkadyenjy2/za-media-ai-growth-engine, main.
Architecture lock: Convex ONLY at runtime; React + convex/react. Do not add Supabase runtime. Production outbound is frozen: PRODUCTION_OUTBOUND_FROZEN=true.
Known production webhook: qualified-nightingale-421.eu-west-1.convex.site/meta-webhook.
Known proof: prior CI and Vercel deployment succeeded; no fake leads/outreach.
Main external blocker: Meta app secret / verify token / page access token and real dashboard activation.
Rules: never fabricate Meta credentials/events/leads or unfreeze outbound just to make tests pass.
Before credits: audit current repo, tests, Convex functions, webhook HMAC/evidence and frozen outbound guard.
Closure: code tests/build pass; webhook integrity and evidence are verified; missing Meta credentials remain explicit BLOCKED.
When credits return: pull main, reproduce only confirmed code gaps, spend minimal builder credits, commit/push and verify CI/Vercel.