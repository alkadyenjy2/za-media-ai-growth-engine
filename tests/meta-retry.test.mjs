import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../convex/metaRetry.ts", import.meta.url), "utf8");

test("retry classifier parses a three-digit upstream HTTP status", () => {
  assert.ok(source.includes('const match = /^META_LEAD_RETRIEVAL_FAILED:(\\d{3}):/.exec(message);'));
});

test("transient upstream statuses trigger Meta retries", () => {
  assert.ok(source.includes("status === 408 || status === 425 || status === 429 || status >= 500"));
});

test("unknown network and persistence errors remain retryable", () => {
  assert.ok(source.includes("if (!match) return true"));
});
