# IdeaCollector Cloudflare Pages mirror preview

This branch is an isolated preview using the existing Cloudflare Pages Git integration for this repository. The `public/_worker.js` file is copied by Vite to `dist/_worker.js`, enabling Pages Advanced Mode for this branch preview only.

## Routing
- The worker forwards paths and query strings to the fixed existing IdeaCollector origin `https://ideacollector-enjy2026.vercel.app`.
- It never accepts a user-supplied upstream hostname, so this is not an open proxy.
- It forwards only `Accept`, `Content-Type`, and explicit `Authorization` headers; browser cookies and Origin are not forwarded.
- API responses carry `Cache-Control: no-store`.
- Redirects to known IdeaCollector Vercel aliases are rewritten back to the Cloudflare preview origin.
- Request bodies above 2 MiB are rejected before contacting the upstream.

## Scope
This is a **Cloudflare-hosted mirror/preview**, not a full migration. It still relies on the existing Vercel-hosted FastAPI runtime and its current Core AI Supabase Edge Function database gateway. Do not retire or redirect the Vercel origin based on this mirror alone.

## Verification requirements
- The proxy unit tests must pass.
- The new Cloudflare branch preview must exist and serve the IdeaCollector UI.
- Verify `/api/health`, `/api/dashboard/overview`, and `/api/integrations/status` through the Cloudflare preview.
- Until a separate Cloudflare-native API and data migration is complete, keep this branch as a preview and do not merge it into the `main` production branch.
