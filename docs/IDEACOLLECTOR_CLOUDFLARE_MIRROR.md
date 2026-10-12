# IdeaCollector Cloudflare preview

This branch uses the existing Cloudflare Pages Git integration as an isolated IdeaCollector preview. The `main` branch and the production ZA Media deployment are unchanged.

## Routing
- The canonical IdeaCollector React/Vite app source is built into static assets by the existing Cloudflare Pages build.
- Non-API requests (HTML, JavaScript, CSS, and other frontend assets) are served directly by the Cloudflare Pages `ASSETS` binding. The response marker is `x-ideacollector-host: cloudflare-pages-assets`.
- Only `/api/*` requests are forwarded to the fixed currently deployed API origin, `https://ideacollector-enjy2026.vercel.app`. API responses carry `x-ideacollector-mirror: cloudflare-edge`.
- The Worker never accepts a caller-supplied upstream host, forwards only `Accept`, `Content-Type`, and an explicit `Authorization` header, and never forwards browser cookies or the browser `Origin`.
- API responses are `Cache-Control: no-store`; request bodies larger than 2 MiB are rejected before contacting upstream. Redirects to known IdeaCollector Vercel aliases are rewritten to the preview origin.

## Current limitation
This is a real Cloudflare-hosted frontend, **not yet a complete Vercel retirement**. The FastAPI runtime, evidence-retrieval code, AI provider integrations, and persistence gateway remain at the existing Vercel API origin. The existing Core AI Supabase Edge Function remains the persistence gateway. No D1 was created or attached, and no database migration or data write was performed.

## Verification
- The Cloudflare preview root returned HTTP 200 with title `IdeaCollector.ai - محرك الأفكار` and the static-host marker `x-ideacollector-host: cloudflare-pages-assets`.
- The main API probes `/api/health`, `/api/dashboard/overview`, `/api/ideas`, and `/api/integrations/status` returned HTTP 200 via `x-ideacollector-mirror: cloudflare-edge`.
- The latest CI run including the proxy test, typecheck, Convex typecheck, and production build passed: https://github.com/alkadyenjy2/za-media-ai-growth-engine/actions/runs/38295392113
- Five local Node contract tests pass for fixed-upstream API routing, cookie/origin isolation, auth header forwarding, redirects, request-size bounds, and static asset serving.
- No form was submitted, no POST was invoked during runtime verification, and no data was created or modified.

Do not merge this branch or switch production domains until a Cloudflare-native API runtime and a bound/verified database have been implemented and tested separately.