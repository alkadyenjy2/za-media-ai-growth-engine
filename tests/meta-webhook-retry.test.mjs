import test from "node:test";
import assert from "node:assert/strict";
import { metaWebhookResponse } from "../convex/metaWebhookResponse.js";

test("returns 503 when any lead in a mixed batch fails", async () => {
  const results = [
    { ok: true, lead_id: "lead-1" },
    { ok: false, leadgen_id: "lead-2", reason: "META_LEAD_RETRIEVAL_FAILED" },
  ];
  const response = metaWebhookResponse(results);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    accepted: false,
    processed: 2,
    results,
  });
});

test("returns 200 when all leads are processed successfully", async () => {
  const results = [{ ok: true, lead_id: "lead-1" }];
  const response = metaWebhookResponse(results);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    accepted: true,
    processed: 1,
    results,
  });
});

test("returns 200 for idempotent duplicates and intentionally ignored results", async () => {
  const results = [
    { ok: true, duplicate: true, lead_id: "lead-1" },
    { ok: true, promoted: false, reason: "REQUIRED_FIELDS_MISSING" },
  ];
  const response = metaWebhookResponse(results);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).accepted, true);
});

test("returns 200 for an empty or non-lead batch", async () => {
  const response = metaWebhookResponse([]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    accepted: true,
    processed: 0,
    results: [],
  });
});
