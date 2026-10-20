import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(resolve(import.meta.dirname, "../supabase/functions/meta-webhook/index.ts"), "utf8");
assert.match(source, /import\s*\{\s*settleWebhookJobs\s*\}\s*from\s*['"]\.\/webhookJobs\.ts['"]/);
assert.match(source, /const\s*\{\s*failedCount,\s*shouldRetry\s*\}\s*=\s*await\s+settleWebhookJobs\(jobs,\s*eventsPendingDurableStorage\)/);
assert.match(source, /if\s*\(shouldRetry\)\s*return\s+json\(\{[^}]*eventsPendingDurableStorage\s*\},\s*503\)/);
assert.doesNotMatch(source, /EdgeRuntime\.waitUntil\(Promise\.all\(jobs\)\)/, "critical webhook jobs must not be detached from the response");
assert.match(source, /throw error/, "failed delegation must remain visible to the settlement policy");
assert.match(source, /let\s+eventsPendingDurableStorage\s*=\s*false/, "permanent rejected events must be tracked until a durable replay record exists");
assert.match(source, /eventsPendingDurableStorage\s*=\s*true/, "blocked and malformed deliveries must not be silently acknowledged");
console.log("7 Supabase handler wiring assertions passed");