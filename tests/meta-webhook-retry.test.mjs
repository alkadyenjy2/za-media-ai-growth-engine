import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../convex/meta.ts", import.meta.url), "utf8");

test("Meta webhook distinguishes retryable and permanent processing failures", () => {
  assert.match(source, /if \(hasTemporaryFailure\)[\s\S]*?status: 503/);
  assert.match(source, /if \(hasPermanentFailure\)[\s\S]*?status: 422/);
  assert.match(source, /accepted: false, processed: results\.length, results/);
});

test("Meta lead idempotency key is scoped to both page and lead", () => {
  assert.match(source, /const idempotencyKey = "meta:" \+ args\.page_id \+ ":" \+ args\.leadgen_id/);
  assert.match(source, /eq\("idempotency_key", idempotencyKey\)/);
});

test("webhook validates a verified connection before Graph API retrieval", () => {
  assert.match(source, /ctx\.runQuery\(internal\.meta\.checkWebhookConnection/);
  assert.ok(source.indexOf("checkWebhookConnection") < source.indexOf("retrieveLead(leadgenId, pageAccessToken)", source.indexOf("export const webhook")));
});

test("upstream Graph API errors are sanitized before webhook response", () => {
  assert.match(source, /META_LEAD_RETRIEVAL_FAILED:" \+ response\.status \+ ":upstream_error"/);
  assert.doesNotMatch(source, /throw new Error\("META_LEAD_RETRIEVAL_FAILED:" \+ response\.status \+ ":" \+ errorText/);
});
