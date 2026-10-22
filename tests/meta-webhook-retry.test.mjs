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
  assert.match(source, /results\.push\(\{ ok: false, leadgen_id: leadgenId, reason:/);
});
