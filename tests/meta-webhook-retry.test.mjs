import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../convex/meta.ts", import.meta.url), "utf8");

test("Meta webhook responds with retryable 503 when lead processing fails", () => {
  assert.match(source, /const hasProcessingFailure = results\.some\(\(result: any\) => result\?\.ok === false\)/);
  assert.match(source, /status: hasProcessingFailure \? 503 : 200/);
  assert.match(source, /accepted: !hasProcessingFailure/);
});

test("Meta lead persistence retains idempotency checks before inserting leads", () => {
  assert.match(source, /eq\("idempotency_key", "meta:" \+ args\.leadgen_id\)/);
  assert.match(source, /row\.action === "meta_webhook_received" && row\.details\?\.leadgen_id === args\.leadgen_id/);
});

test("Failed Graph API retrieval is surfaced as a processing failure", () => {
  assert.match(source, /results\.push\(\{ ok: false, leadgen_id: leadgenId, reason/);
});

test("webhook durably records each signed lead event before calling Meta Graph", () => {
  const receipt = source.indexOf("ctx.runMutation(internal.meta.recordWebhookReceipt");
  const retrieval = source.indexOf("await retrieveLead(leadgenId, pageAccessToken)");
  assert.ok(receipt >= 0, "must persist a durable receipt before retrieving lead details");
  assert.ok(retrieval >= 0, "must retrieve lead details after receipt");
  assert.ok(receipt < retrieval, "receipt must be committed before external retrieval");
});

test("durable webhook event ledger is indexed by stable page and lead ID and tracks retry state", async () => {
  const schema = await readFile(new URL("../convex/schema.ts", import.meta.url), "utf8");
  assert.match(schema, /meta_webhook_events: defineTable/);
  assert.match(schema, /by_event_key/);
  assert.match(schema, /status: v\.union\(v\.literal\("received"\), v\.literal\("processing"\), v\.literal\("processed"\), v\.literal\("retryable_failed"\)\)/);
  assert.match(source, /args\.page_id \+ ":" \+ args\.leadgen_id/);
  assert.match(source, /recordWebhookReceipt/);
});

test("Meta Graph error response bodies are not surfaced to webhook callers", () => {
  assert.doesNotMatch(source, /const errorText = await response\.text\(\)/);
  assert.match(source, /META_LEAD_RETRIEVAL_FAILED/);
});

test("new lead idempotency keys are scoped to both page and lead while legacy keys remain checked", () => {
  assert.match(source, /idempotency_key: "meta:" \+ args\.page_id \+ ":" \+ args\.leadgen_id/);
  assert.match(source, /idempotency_key: "meta:" \+ args\.leadgen_id/);
});
