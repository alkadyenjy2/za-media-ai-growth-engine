import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requireFromRoot = createRequire(resolve(root, "package.json"));
function loadEsbuild() {
  try {
    return requireFromRoot("esbuild");
  } catch (error) {
    const pnpmStore = resolve(root, "node_modules/.pnpm");
    const candidates = readdirSync(pnpmStore).filter((name) => /^esbuild@/.test(name)).sort();
    if (candidates.length === 0) throw error;
    return requireFromRoot(resolve(pnpmStore, candidates[candidates.length - 1], "node_modules/esbuild/lib/main.js"));
  }
}
const { buildSync } = loadEsbuild();
mkdirSync(resolve(root, "node_modules/.cache"), { recursive: true });
const bundlePath = resolve(root, "node_modules/.cache/meta-unverified-connection-retry.cjs");
buildSync({ entryPoints: [resolve(root, "convex/meta.ts")], bundle: true, platform: "node", format: "cjs", packages: "external", outfile: bundlePath });
const { enqueueWebhookEvent, claimDueWebhookEvents } = requireFromRoot(bundlePath);

function makeContext() {
  let event = null;
  let connection = null;
  const audit = [];
  const ctx = {
    db: {
      query(table) {
        let status;
        let upperBound = Infinity;
        return {
          withIndex(_index, build) {
            const q = {
              eq(field, value) { if (field === "status") status = value; return q; },
              lte(_field, value) { upperBound = value; return q; },
            };
            build(q);
            return {
              async unique() {
                if (table === "meta_connections") return connection;
                if (table === "meta_webhook_events") return event;
                return null;
              },
              async take(limit) {
                if (table !== "meta_webhook_events" || !event) return [];
                if (status && event.status !== status) return [];
                if (event.next_attempt_at > upperBound) return [];
                return [event].slice(0, limit);
              },
            };
          },
        };
      },
      async insert(table, data) {
        if (table === "meta_webhook_events") {
          event = { _id: { toString: () => "event-1" }, ...data };
          return event._id;
        }
        if (table === "audit_logs") audit.push(data);
        return "audit-" + audit.length;
      },
      async patch(_id, patch) { Object.assign(event, patch); },
      async get() { return event; },
      async delete() { event = null; },
    },
  };
  return {
    ctx,
    audit,
    get event() { return event; },
    set connection(value) { connection = value; },
  };
}

test("unverified Meta delivery is durable and retryable, then claimed after verification", async () => {
  const state = makeContext();
  const receivedAt = Date.now() - 1000;
  const result = await enqueueWebhookEvent._handler(state.ctx, {
    page_id: "test-page-not-blocklisted",
    leadgen_id: "test-lead-before-verification",
    form_id: "test-form",
    created_time: "",
    received_at: receivedAt,
  });

  assert.equal(result.status, "pending");
  assert.equal(result.durable, true);
  assert.equal(state.event.status, "pending");
  assert.equal(state.event.terminal_at, undefined);
  assert.equal(state.event.terminal_reason, undefined);
  assert.equal(state.event.attempt_count, 0);
  assert.equal(state.event.last_error, "NO_VERIFIED_META_CONNECTION");

  // Simulate the scheduled retry becoming due; no external call or production data is involved.
  state.event.next_attempt_at = Date.now() - 1;
  state.connection = { workspace_id: "test-workspace", status: "verified", verified_at: Date.now() };

  const claimed = await claimDueWebhookEvents._handler(state.ctx);
  assert.equal(claimed.claimed.length, 1);
  assert.equal(claimed.claimed[0].event_key, "meta:test-page-not-blocklisted:test-lead-before-verification");
  assert.equal(state.event.status, "processing");
  assert.equal(state.event.attempt_count, 1);
  assert.equal(state.event.last_verified_at >= receivedAt, true);
  assert.equal(state.event.last_error, undefined);
});

test("explicitly blocklisted Meta pages remain terminal", async () => {
  const state = makeContext();
  const result = await enqueueWebhookEvent._handler(state.ctx, {
    page_id: "179969831856298",
    leadgen_id: "test-blocked-lead",
    form_id: "test-form",
    created_time: "",
    received_at: Date.now(),
  });
  assert.equal(result.status, "blocked");
  assert.equal(state.event.status, "blocked");
  assert.equal(state.event.terminal_reason, "BLOCKED_PAGE_ID");
  assert.equal(state.audit.length, 1);
});
