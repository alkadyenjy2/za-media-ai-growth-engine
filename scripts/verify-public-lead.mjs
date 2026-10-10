import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
const publicLead = readFileSync(new URL('../convex/publicLead.ts', import.meta.url), 'utf8');
const http = readFileSync(new URL('../convex/http.ts', import.meta.url), 'utf8');

if (/import\s*\{?\s*dataClient\b/.test(landing)) {
  throw new Error('LandingPage must not import the unused legacy dataClient');
}
if (!http.includes('path: "/health"') || !http.includes('handler: health')) {
  throw new Error('Convex HTTP router must expose the health liveness handler');
}
if (!http.includes('path: "/public-lead"') || !http.includes('handler: publicLeadSubmit')) {
  throw new Error('Convex HTTP router must expose the public-lead handler');
}
if (!publicLead.includes('export const submit = httpAction')) {
  throw new Error('publicLead must expose the public HTTP action');
}
if (/workspaces\.find\([^\n]+\)\s*\?\?\s*workspaces\[0\]/.test(publicLead)) {
  throw new Error('Public lead intake must not fall back to an arbitrary workspace');
}
if (!publicLead.includes('if (!workspace) throw new Error("ZA Media workspace is not initialized")')) {
  throw new Error('Public lead intake must fail closed when the ZA Media workspace is missing');
}

if (!publicLead.includes('withIndex("by_idempotency"') || !publicLead.includes('duplicate: true')) {
  throw new Error('Public lead intake must suppress duplicate daily email submissions before creating records');
}
if (!publicLead.includes('result.duplicate ? 200 : 201')) {
  throw new Error('Public lead intake must return HTTP 200 for an idempotently suppressed duplicate');
}

console.log('public-lead regression checks passed');
