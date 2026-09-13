# ZA Media AI Growth Engine

> A public engineering case study for an AI-assisted growth and operations system spanning lead intake, qualification, CRM-oriented workflows, intelligence, and business visibility.

**Live project:** https://za-media-ai-growth-engine.vercel.app

## Overview

ZA Media AI Growth Engine is a React/TypeScript application with a Supabase-backed operations layer. The public repository documents an implementation that brings together product surfaces, AI-assisted qualification and audit flows, prospect and website intelligence, scoring, service matching, opportunity workflows, and workspace-oriented operations.

This repository is presented as an **engineering case study**. The code and repository history are evidence of implementation work; they are not, by themselves, evidence of revenue, ROI, customer count, or commercial outcomes.

## System areas

The current repository contains implementation work across:

- Lead and prospect intake surfaces.
- AI-assisted qualification and growth-audit flows.
- Website and social intelligence functions.
- Prospect monitoring, scoring, intent, opportunity, and service-matching logic.
- Personalized outreach generation.
- CRM/workspace-oriented product surfaces.
- Authentication and workspace boundaries backed by Supabase.
- Product identity, design tokens, and reusable brand assets.

## Repository structure

```text
.github/workflows/   CI / automation configuration
src/                 React + TypeScript application code
supabase/            Supabase configuration, migrations, and Edge Functions
docs/                Product and engineering documentation
public/brand/        Canonical product identity assets
index.html           Vite application entry
package.json         Runtime and development dependencies/scripts
vercel.json          SPA deployment rewrite configuration
```

## Technical foundation

The repository's `package.json` directly identifies the following stack:

- React 18
- TypeScript 5.7
- Vite 6
- Tailwind CSS 3
- Supabase JavaScript client
- Supabase Edge Functions / Deno runtime code
- Recharts
- Lucide React

The server-side functions read provider credentials from environment variables and include Gemini-backed AI paths. Secrets are expected to remain outside the repository.

## What I built

The public codebase includes work on:

- A growth-engine product surface for operational visibility.
- AI qualification and growth-audit paths.
- Website, social, geographic, and prospect intelligence functions.
- Intent and scoring engines for structured signals.
- Opportunity and service-matching workflows.
- Personalized outreach generation.
- CRM/workspace foundations and authentication boundaries.
- A documented product identity system with shared tokens, typography, and brand assets.
- Vercel SPA deployment configuration for deep-link routing.

## Engineering signals

The public implementation history includes work on multiple server-side AI and intelligence functions, including qualification, audit, prospect monitoring, meta prospecting, scoring, social intelligence, intent, outreach, geo intelligence, service matching, opportunity processing, and website intelligence.

The repository also separates application code, Supabase infrastructure, documentation, brand assets, and deployment configuration rather than presenting the project as a single undifferentiated prototype.

## Evidence boundaries

### What GitHub proves

- The repository is public and contains the implementation and documentation described above.
- The application is structured around React/TypeScript/Vite with Supabase integration.
- AI and intelligence functions exist in the repository and use environment-based server configuration.
- The repository contains explicit product identity documentation and deployment configuration.

### What the live deployment can prove

The deployed application can be used as runtime evidence for whatever behavior is currently reachable from the public environment. Runtime behavior should be evaluated separately from source-code inspection.

### What this repository does not prove by itself

GitHub source code alone does not establish revenue, ROI, customer count, production business impact, or successful execution of every external integration. Those claims require independent runtime, operational, or business evidence.

## Local development

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Run the TypeScript build/type checks used by the repository:

```bash
npm run typecheck
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Status

**Public engineering case study with an active implementation history.**

The repository documents the architecture and implementation boundaries that can be verified from GitHub. Production integrations and external business outcomes are intentionally described conservatively unless independently verified.

## Related work

- [ENJY AI COO](https://github.com/alkadyenjy2/enjY-ai-coo) — AI operations, orchestration, verification, and executive-system architecture.
- [Portfolio](https://enjyfolio-gwdudsqs.manus.space) — selected projects and professional case studies.

## Security note

Server credentials such as `GEMINI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are read from environment variables by server-side functions. The repository's `.gitignore` excludes `.env*` files by default, with `.env.example` explicitly allowed.
