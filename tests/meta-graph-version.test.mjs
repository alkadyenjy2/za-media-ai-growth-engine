import test from "node:test";
import assert from "node:assert/strict";
import { resolveMetaGraphApiVersion } from "../convex/meta-version.js";

test("defaults Meta Graph API to v26.0", () => {
  assert.equal(resolveMetaGraphApiVersion({}), "v26.0");
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: " " }), "v26.0");
});

test("accepts explicitly configured v26 and newer stable major versions", () => {
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v26.0" }), "v26.0");
  assert.equal(resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v27.0" }), "v27.0");
});

test("fails closed for deprecated API versions below v26", () => {
  assert.throws(
    () => resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "v25.0" }),
    /v26\.0 or newer/,
  );
});

test("rejects malformed API version overrides", () => {
  assert.throws(
    () => resolveMetaGraphApiVersion({ META_GRAPH_API_VERSION: "26" }),
    /stable major version/,
  );
});
