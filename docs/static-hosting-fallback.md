# ZA Media static frontend hosting fallback

This repository is a React + Vite frontend with Convex as its canonical backend. The Render Blueprint in `render.yaml` creates a separate **static frontend staging site only**; it does not deploy, migrate, or replace Convex.

## Create the staging site

1. Connect this repository to Render and create a Blueprint from `render.yaml`.
2. Review the plan and build settings before confirming.
3. Configure `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` in the service's environment settings using the values from the existing canonical Convex deployment. These are build-time frontend configuration values, not a place for secrets.
4. Manually deploy the staging site after reviewing the build output. Automatic deploys are disabled in the Blueprint.

Render static sites are served through a global CDN and can be hosted for free. Vite bakes `VITE_*` values into the frontend at build time, so changing either value requires a rebuild. The SPA rewrite is included so routes such as `/app/leads` serve `index.html`. References: [Render static sites](https://render.com/docs/static-sites) and [Blueprint specification](https://render.com/docs/blueprint-spec).

## Safety and verification

- Keep the canonical Convex deployment `qualified-nightingale-421` unchanged.
- Keep `PRODUCTION_OUTBOUND_FROZEN = true`; do not publish, send outreach, or trigger production mutations during hosting tests.
- Do not add Meta credentials or webhook verification secrets to this frontend; those belong in the Convex server environment.
- Confirm the built site loads, browser routes refresh correctly, auth points to the existing Convex deployment, and browser console/network errors are reviewed.
- Verify the existing Convex health endpoint separately. A healthy static site does not prove Convex auth, Meta webhook verification, persistence, or deduplication works.
- Do not change the production domain or declare production cutover complete until these checks pass.

This PR prepares a reversible hosting option only. It does not deploy a service or change the current production route.
