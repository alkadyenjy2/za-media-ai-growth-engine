import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const originalRoot = "C:/Users/LTC/Documents/Codex/za-media-ai-growth-engine";
const requireFromOriginal = createRequire(resolve(originalRoot, "package.json"));
const { buildSync } = requireFromOriginal(resolve(originalRoot, "node_modules/.pnpm/esbuild@0.27.0/node_modules/esbuild/lib/main.js"));
const root = resolve(import.meta.dirname, "..");
const coreBundle = resolve(originalRoot, "node_modules/.cache/core-data-safety-under-test.cjs");
const metaBundle = resolve(originalRoot, "node_modules/.cache/meta-retention-safety-under-test.cjs");
const aiBundle = resolve(originalRoot, "node_modules/.cache/ai-auth-under-test.cjs");
buildSync({ entryPoints: [resolve(root, "convex/core.ts")], bundle: true, platform: "node", format: "cjs", packages: "external", outfile: coreBundle });
buildSync({ entryPoints: [resolve(root, "convex/meta.ts")], bundle: true, platform: "node", format: "cjs", packages: "external", outfile: metaBundle });
buildSync({ entryPoints: [resolve(root, "convex/ai.ts")], bundle: true, platform: "node", format: "cjs", packages: "external", outfile: aiBundle });
const { insert, update, remove, recordAudit } = requireFromOriginal(coreBundle);
const { claimDueWebhookEvents } = requireFromOriginal(metaBundle);
const { qualifyLead } = requireFromOriginal(aiBundle);

function coreContext(recordTable = "meta_connections") {
  const record = { _id: "record-1", workspace_id: "workspace-a", status: "pending", page_id: "page-a", verified_at: undefined };
  const workspace = { _id: { toString: () => "workspace-a" }, ownerSubject: "user-a" };
  const patches = [];
  const inserts = [];
  const deletes = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ subject: "user-a" }) },
    db: {
      normalizeId: (table, id) => table === recordTable && id === "record-1" ? id : null,
      query(table) {
        return {
          withIndex(_name, build) {
            const q = { eq() { return q; }, lte() { return q; }, lt() { return q; } };
            build(q);
            return {
              unique: async () => table === "workspaces" ? workspace : null,
              first: async () => table === recordTable ? record : null,
              take: async () => [],
            };
          },
          filter() { return { first: async () => table === recordTable ? record : null }; },
        };
      },
      get: async () => record,
      patch: async (_id, data) => { patches.push(data); Object.assign(record, data); },
      insert: async (table, data) => { inserts.push({ table, data }); return "inserted"; },
      delete: async (id) => { deletes.push(id); },
    },
  };
  return { ctx, record, patches, inserts, deletes };
}

test("generic CRUD cannot mark a Meta connection verified by lying about its table", async () => {
  const { ctx, record, patches } = coreContext("meta_connections");
  await assert.rejects(
    () => update._handler(ctx, { table: "companies", id: "record-1", data: { status: "verified", verified_at: Date.now() } }),
    /record not found|table mismatch|verification is server-controlled/i,
  );
  assert.equal(record.status, "pending");
  assert.equal(patches.length, 0);
});

test("generic CRUD cannot transfer a record into another workspace", async () => {
  const { ctx, record, patches } = coreContext("companies");
  await assert.rejects(
    () => update._handler(ctx, { table: "companies", id: "record-1", data: { workspace_id: "workspace-victim" } }),
    /workspace_id cannot change|cannot change workspace/i,
  );
  assert.equal(record.workspace_id, "workspace-a");
  assert.equal(patches.length, 0);
});

test("Meta event sweep never deletes unrelated audit history automatically", async () => {
  const unrelatedAudit = { _id: "audit-unrelated", action: "invoice_paid", created_at: "2020-01-01T00:00:00.000Z" };
  const deleted = [];
  const queried = [];
  const ctx = { db: {
    query(table) {
      return { withIndex(name, build) {
        queried.push({ table, name });
        const q = { eq() { return q; }, lte() { return q; }, lt() { return q; } };
        build(q);
        return { take: async () => table === "audit_logs" && name === "by_created_at" ? [unrelatedAudit] : [] };
      } };
    },
    get: async () => null,
    delete: async (id) => { deleted.push(id); },
    patch: async () => {},
    insert: async () => "audit-new",
  } };
  await claimDueWebhookEvents._handler(ctx, {});
  assert.deepEqual(deleted, [], "retention cleanup must not delete business audit logs without an approved scoped policy");
  assert.equal(queried.some((item) => item.table === "audit_logs" && item.name === "by_created_at"), false,
    "the sweeper must not run broad audit-log retention");
});

test("public AI qualification refuses unauthenticated requests", async () => {
  await assert.rejects(
    () => qualifyLead._handler({ auth: { getUserIdentity: async () => null } }, { lead: { company_name: "Example" } }),
    /not authenticated/i,
  );
});

test("fallback qualification does not penalize Egypt or roofing as categories", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const ctx = { auth: { getUserIdentity: async () => ({ subject: "user-a" }) } };
  try {
    const shared = { company_name: "Example Co", email: "owner@example.test", website: "https://example.test", phone: "+201000000000", country: "Canada" };
    const roofing = await qualifyLead._handler(ctx, { lead: { ...shared, industry: "roofing" } });
    const plumbing = await qualifyLead._handler(ctx, { lead: { ...shared, industry: "plumbing" } });
    assert.equal(roofing.score, plumbing.score, "industry label must not create an unsupported 30-point penalty");
    const egypt = await qualifyLead._handler(ctx, { lead: { ...shared, country: "Egypt", industry: "plumbing" } });
    assert.equal(egypt.score, plumbing.score, "country label must not create an unsupported 30-point penalty");
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
test("generic CRUD cannot forge, rewrite, or delete audit evidence", async () => {
  const { ctx, patches, inserts, deletes } = coreContext("audit_logs");
  await assert.rejects(
    () => insert._handler(ctx, { table: "audit_logs", data: { action: "fake_event", entity_type: "lead", actor: "dashboard", details: {} } }),
    /audit logs are append-only/i,
  );
  await assert.rejects(
    () => update._handler(ctx, { table: "audit_logs", id: "record-1", data: { action: "tampered_event" } }),
    /audit logs are append-only/i,
  );
  await assert.rejects(
    () => remove._handler(ctx, { table: "audit_logs", id: "record-1" }),
    /audit logs are append-only/i,
  );
  assert.equal(patches.length, 0);
  assert.equal(inserts.length, 0);
  assert.equal(deletes.length, 0);
});
test("Meta connection status cannot be changed through generic CRUD", async () => {
  const { ctx, record, patches } = coreContext("meta_connections");
  await assert.rejects(
    () => update._handler(ctx, { table: "meta_connections", id: "record-1", data: { status: "verified", verified_at: Date.now() } }),
    /Meta connection status is server-controlled/i,
  );
  assert.equal(record.status, "pending");
  assert.equal(patches.length, 0);
});

test("audit actor is assigned by the server identity, not caller-provided text", async () => {
  const { ctx, inserts } = coreContext("audit_logs");
  await recordAudit._handler(ctx, { action: "lead.reviewed", entity_type: "lead", entity_id: "lead-a", details: {}, actor: "spoofed-admin" });
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].table, "audit_logs");
  assert.equal(inserts[0].data.actor, "user-a");
  assert.equal(inserts[0].data.workspace_id, "workspace-a");
});
