import assert from "node:assert/strict";
import { createHmac, webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
const requireForConvex = createRequire(import.meta.url);
const convexRoot = resolve(dirname(requireForConvex.resolve("convex")), "../..");
const { buildSync } = createRequire(resolve(convexRoot, "package.json"))("esbuild");

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const root = resolve(import.meta.dirname, "..");
const bundlePath = resolve(root, "node_modules/.cache/meta-webhook-under-test.cjs");
mkdirSync(dirname(bundlePath), { recursive: true });
buildSync({ entryPoints: [resolve(root, "convex/meta.ts")], bundle: true, platform: "node", format: "cjs", packages: "external", outfile: bundlePath });
const require = createRequire(import.meta.url);
const { webhook, recordWebhook } = require(bundlePath);
assert.equal(typeof webhook?._handler, "function", "must invoke the actual exported Convex HTTP action handler");
assert.equal(typeof recordWebhook?._handler, "function", "must invoke the actual exported Convex mutation handler");

const oldEnv = { META_APP_SECRET: process.env.META_APP_SECRET, META_PAGE_ACCESS_TOKEN: process.env.META_PAGE_ACCESS_TOKEN };
const oldFetch = globalThis.fetch;
process.env.META_APP_SECRET = "local-test-app-secret";
process.env.META_PAGE_ACCESS_TOKEN = "local-test-page-token";
const body = JSON.stringify({ object: "page", entry: [{ id: "test-page", changes: [{ field: "leadgen", value: { page_id: "test-page", leadgen_id: "local-lead-123", form_id: "local-form-1" } }] }] });
const signature = "sha256=" + createHmac("sha256", process.env.META_APP_SECRET).update(body).digest("hex");
const request = () => new Request("https://local.test/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body });
const invalidSignatureRequest = () => new Request("https://local.test/webhook", { method: "POST", headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) }, body });
const ctx = (runMutation, runQuery = async () => ({ ok: true })) => ({ runMutation, runQuery });
const fetchLead = async () => new Response(JSON.stringify({ id: "local-lead-123", field_data: [] }), { status: 200, headers: { "content-type": "application/json" } });

try {
  let queryCalls = 0;
  let mutationCalls = 0;
  let graphCalls = 0;
  globalThis.fetch = async () => { graphCalls += 1; return fetchLead(); };
  const invalidSignatureResponse = await webhook._handler({
    runQuery: async () => { queryCalls += 1; return { ok: true }; },
    runMutation: async () => { mutationCalls += 1; return { ok: true }; },
  }, invalidSignatureRequest());
  assert.equal(invalidSignatureResponse.status, 401, "invalid signatures must be rejected");
  assert.equal(queryCalls, 0, "invalid signatures must not read connection or event state");
  assert.equal(mutationCalls, 0, "invalid signatures must not write records");
  assert.equal(graphCalls, 0, "invalid signatures must not trigger Graph requests");

  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  let response = await webhook._handler(ctx(async () => { throw new Error("mutation must not run after fetch failure"); }), request());
  assert.equal(response.status, 503, "network failures must return HTTP 503 for provider retry");
  let result = await response.json();
  assert.equal(result.results[0].retryable, true);
  assert.equal(result.results[0].reason, "TEMPORARY_WEBHOOK_PROCESSING_FAILURE", "internal exception details must not leak in webhook responses");

  let blockedFetchCalls = 0;
  globalThis.fetch = async () => { blockedFetchCalls += 1; return fetchLead(); };
  response = await webhook._handler(ctx(async () => { throw new Error("mutation must not run for an unverified connection"); }, async () => ({ ok: false, reason: "NO_VERIFIED_META_CONNECTION" })), request());
  assert.equal(response.status, 422, "unverified Meta connections must be rejected before Graph retrieval");
  assert.equal(blockedFetchCalls, 0, "unverified connections must not trigger outbound Graph requests");

  globalThis.fetch = fetchLead;
  response = await webhook._handler(ctx(async () => { throw new Error("database temporarily unavailable"); }), request());
  assert.equal(response.status, 503, "unclassified mutation/storage failures must return HTTP 503");

  globalThis.fetch = async () => new Response("bad request", { status: 400 });
  response = await webhook._handler(ctx(async () => { throw new Error("mutation must not run for Meta HTTP 400"); }), request());
  assert.equal(response.status, 422, "known permanent Meta client errors must not be treated as transient");
  result = await response.json();
  assert.equal(result.results[0].reason, "META_LEAD_RETRIEVAL_FAILED:400:upstream_error", "permanent Meta errors must be classified without leaking upstream details");

  globalThis.fetch = fetchLead;
  response = await webhook._handler(ctx(async () => ({ ok: true, duplicate: false, promoted: true, lead_id: "local-lead-1" })), request());
  assert.equal(response.status, 200, "fully processed events must return HTTP 200");
  result = await response.json();
  assert.equal(result.results[0].leadgen_id, "local-lead-123");

  let inserts = 0;
  let observedIdempotencyKey = "";
  const duplicateCtx = { db: {
    query(table) {
      return { withIndex(index, callback) { return { async unique() {
        if (table === "meta_connections" && index === "by_page") return { workspace_id: "local-workspace", status: "verified" };
        if (table === "leads" && index === "by_idempotency") { callback({ eq(_field, value) { observedIdempotencyKey = value; return this; } }); return { _id: { toString: () => "existing-local-lead" } }; }
        return null;
      }, async collect() { return []; } }; } };
    }, async insert() { inserts += 1; return "unexpected-insert"; }
  } };
  result = await recordWebhook._handler(duplicateCtx, { page_id: "test-page", leadgen_id: "local-lead-123", form_id: "local-form-1", created_time: "", raw_payload: {}, retrieved_lead: {} });
  assert.equal(result.duplicate, true, "the production mutation must identify an existing idempotency key");
  assert.equal(observedIdempotencyKey, "meta:test-page:local-lead-123", "Meta idempotency must include page_id and leadgen_id");
  assert.equal(inserts, 0, "the production mutation must not insert records for a known duplicate");

  console.log("PASS: invalid signature returns 401 without DB or Graph calls");
  console.log("PASS: production webhook handler network failure => 503");
  console.log("PASS: exception detail is sanitized");
  console.log("PASS: production webhook handler mutation failure => 503");
  console.log("PASS: unverified Meta connection is rejected before outbound Graph retrieval");
  console.log("PASS: production webhook handler permanent Meta 400 => 422");
  console.log("PASS: production webhook handler successful processing => 200");
  console.log("PASS: production recordWebhook mutation duplicate => no inserts");
  console.log("PASS: Meta idempotency key includes page_id and leadgen_id");
  console.log("9/9 webhook safety regression cases passed (local mocks only; no Meta/Convex network access)");
} finally {
  globalThis.fetch = oldFetch;
  for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
