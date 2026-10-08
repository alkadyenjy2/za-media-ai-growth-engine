import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
const publicLead = readFileSync(new URL('../convex/publicLead.ts', import.meta.url), 'utf8');
const http = readFileSync(new URL('../convex/http.ts', import.meta.url), 'utf8');

if (/import\\s*\\{?\\s*dataClient\\b/.test(landing)) {
  throw new Error('LandingPage must not import the unused legacy dataClient');
}
if (!http.includes('path: "/public-lead"') || !http.includes('handler: publicLeadSubmit')) {
  throw new Error('Convex HTTP router must expose the public-lead handler');
}
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!pkg.scripts.build?.includes('codegen:convex') || !pkg.scripts.typecheck?.includes('codegen:convex')) {
  throw new Error('Build and typecheck must generate Convex API bindings before TypeScript compilation');
}
if (!publicLead.includes('export const submit = httpAction')) {
  throw new Error('publicLead must expose the public HTTP action');
}

console.log('public-lead regression checks passed');
