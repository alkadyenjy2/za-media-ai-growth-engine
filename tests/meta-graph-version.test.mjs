import test from "node:test";
import assert from "node:assert/strict";
import { resolveMetaGraphApiVersion } from "../convex/metaVersion.js";

test("defaults Meta Graph API to v26.0", () => {
  assert.equal(resolveMetaGraphApiVersion({}), "v26.0");
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: " " }), "v26.0");
});

test("accepts explicitly configured v26 and newer stable major versions", () => {
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v26.0" }), "v26.0");
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v27.0" }), "v27.0");
});

test("allows the prior stable Graph version before the October 27 sunset", () => {
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v25.0" }, new Date("2026-10-26T23:59:59.999Z")), "v25.0");
});

test("fails with migration_required after the October 27 sunset when configured below v26", () => {
  assert.throws(
    () => resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v25.0" }, new Date("2026-10-27T00:00:00.000Z")),
    (error) => error?.code === "migration_required" && error?.status === 503,
  );
});

test("rejects malformed API version overrides", () => {
  assert.throws(
    () => resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "26" }),
    /stable major version/,
  );
});
