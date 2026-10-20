import test from "node:test";
import { createHmac, webcrypto } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const originalRoot = "C:/Users/LTC/Documents/Codex/za-media-ai-growth-engine";
const requireFromOriginal = createRequire(resolve(originalRoot, "package.json"));
const { buildSync } = requireFromOriginal(resolve(originalRoot, "node_modules/.pnpm/esbuild@0.27.0/node_modules/esbuild/lib/main.js"));
const root = resolve(import.meta.dirname, "..");
const bundlePath = resolve(originalRoot, "node_modules/.cache/meta-idempotency-under-test.cjs");
buildSync({ entryPoints: [resolve(root, "convex/meta.ts")], bundle: true, platform: "node", format: "cjs", packages: "external", outfile: bundlePath });
const { recordWebhook, webhook } = requireFromOriginal(bundlePath);
if (!globalThis.crypto) globalThis.crypto = webcrypto;
assert.equal(typeof recordWebhook?._handler, "function");

function context(existingLead) {
  const lookupKeys = [];
  const inserts = [];
  const patches = [];
  const event = { _id: "event-1", status: "processing", attempt_count: 1, received_at: Date.now(), event_key: "meta:page-a:lead-123" };
  const ctx = { db: {
    query(table) {
      let filter;
      return { withIndex(_index, build) {
        const q = { eq(field, value) { filter = { field, value }; return q; }, lte() { return q; } };
        build(q);
        return { async unique() {
          if (table === "meta_connections") return { workspace_id: "workspace-a", status: "verified" };
          if (table === "meta_webhook_events") return event;
          if (table === "leads") {
            lookupKeys.push(filter?.value);
            return existingLead?.idempotency_key === filter?.value ? { _id: { toString: () => "existing-lead" } } : null;
          }
          return null;
        } };
      } };
    },
    async insert(table, data) { inserts.push({ table, data }); return "insert-" + inserts.length; },
    async patch(_id, data) { patches.push(data); Object.assign(event, data); },
    async get() { return event; },
  } };
  return { ctx, lookupKeys, inserts, patches, event };
}const args = { page_id: "page-a", leadgen_id: "lead-123", form_id: "form-a", created_time: "", raw_payload: {}, retrieved_lead: { field_data: [] } };

test("idempotency key includes both page_id and leadgen_id", async () => {
  const { ctx, lookupKeys } = context({ idempotency_key: "meta:lead-123" });
  const result = await recordWebhook._handler(ctx, args);
  assert.equal(lookupKeys[0], "meta:page-a:lead-123");
  assert.notEqual(result.duplicate, true, "a legacy lead key without page identity must not collide across pages");
});

test("same page and leadgen delivery remains idempotent", async () => {
  const { ctx, lookupKeys, inserts } = context({ idempotency_key: "meta:page-a:lead-123" });
  const result = await recordWebhook._handler(ctx, args);
  assert.equal(lookupKeys[0], "meta:page-a:lead-123");
  assert.equal(result.duplicate, true);
  assert.equal(inserts.length, 0, "duplicates must not create audit, company, contact, or lead side effects");
});

test("invalid signature is rejected before Graph fetch or any mutation", async () => {
  const previousSecret = process.env.META_APP_SECRET;
  const previousToken = process.env.META_PAGE_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.META_APP_SECRET = "test-secret";
  process.env.META_PAGE_ACCESS_TOKEN = "test-page-token";
  let graphCalls = 0;
  let mutationCalls = 0;
  globalThis.fetch = async () => { graphCalls += 1; return new Response("{}", { status: 200 }); };
  try {
    const body = JSON.stringify({ object: "page", entry: [{ id: "page-a", changes: [{ field: "leadgen", value: { page_id: "page-a", leadgen_id: "lead-123" } }] }] });
            const response = await webhook._handler({ runMutation: async () => { mutationCalls += 1; } }, new Request("https://local.test/webhook", { method: "POST", headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) }, body }));
    assert.equal(response.status, 401);
    assert.equal(graphCalls, 0);
    assert.equal(mutationCalls, 0, "no event/evidence mutation may occur before signature verification");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET; else process.env.META_APP_SECRET = previousSecret;
    if (previousToken === undefined) delete process.env.META_PAGE_ACCESS_TOKEN; else process.env.META_PAGE_ACCESS_TOKEN = previousToken;
  }
});
test("blocked page is durably recorded before acknowledgement and never calls Graph", async () => {
  const previousSecret = process.env.META_APP_SECRET;
  const previousToken = process.env.META_PAGE_ACCESS_TOKEN;
  const previousFetch = globalThis.fetch;
  const secret = "test-secret";
  process.env.META_APP_SECRET = secret;
  process.env.META_PAGE_ACCESS_TOKEN = "test-page-token";
  let graphCalls = 0;
  let mutationCalls = 0;
  globalThis.fetch = async () => { graphCalls += 1; return new Response("{}", { status: 200 }); };
  try {
    const body = JSON.stringify({ object: "page", entry: [{ id: "179969831856298", changes: [{ field: "leadgen", value: { page_id: "179969831856298", leadgen_id: "blocked-lead-1" } }] }] });
    const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    const response = await webhook._handler({ runMutation: async () => { mutationCalls += 1; return { shouldRetrieve: false, status: "blocked", durable: true }; } }, new Request("https://local.test/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body }));
    assert.equal(response.status, 200, "a durably stored blocked event can be acknowledged");
    assert.equal(graphCalls, 0, "blocked pages must not trigger Graph retrieval");
    assert.equal(mutationCalls, 1, "the signed delivery must be persisted before acknowledgement");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousSecret === undefined) delete process.env.META_APP_SECRET; else process.env.META_APP_SECRET = previousSecret;
    if (previousToken === undefined) delete process.env.META_PAGE_ACCESS_TOKEN; else process.env.META_PAGE_ACCESS_TOKEN = previousToken;
  }
});
test("normal delivery followed by replay and duplicate Meta delivery creates one lead", async () => {
  const rows = [];
  const inserts = [];
  const event = { _id: "event-1", status: "processing", attempt_count: 1, received_at: Date.now(), event_key: "meta:page-a:lead-123" };
  const ctx = { db: {
    query(table) {
      let filter;
      return { withIndex(_index, build) {
        const q = { eq(field, value) { filter = { field, value }; return q; } };
        build(q);
        return { async unique() {
          if (table === "meta_connections") return { workspace_id: "workspace-a", status: "verified" };
          if (table === "meta_webhook_events") return event;
          if (table === "leads") return rows.find((row) => row.idempotency_key === filter?.value) ?? null;
          return null;
        } };
      } };
    },
    async insert(table, data) {
      const id = "row-" + (rows.length + inserts.length + 1);
      const row = { _id: id, ...data };
      inserts.push({ table, row });
      if (table === "leads") rows.push(row);
      return id;
    },
    async patch(_id, data) { Object.assign(event, data); },
  } };  const completeArgs = { ...args, retrieved_lead: { field_data: [
    { name: "email", values: ["lead@example.test"] },
    { name: "phone_number", values: ["+201000000000"] },
    { name: "full_name", values: ["Test Lead"] },
    { name: "company_name", values: ["Test Company"] },
  ] } };
  const first = await recordWebhook._handler(ctx, completeArgs);
  assert.equal(first.promoted, true);
  assert.equal(rows.length, 1);
  const insertCountAfterFirst = inserts.length;
  const replay = await recordWebhook._handler(ctx, completeArgs);
  const duplicate = await recordWebhook._handler(ctx, completeArgs);
  assert.equal(replay.duplicate, true);
  assert.equal(duplicate.duplicate, true);
  assert.equal(rows.length, 1);
  assert.equal(inserts.length, insertCountAfterFirst, "replay and duplicate delivery must not repeat side effects");
});