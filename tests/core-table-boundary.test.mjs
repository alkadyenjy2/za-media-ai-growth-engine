import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../convex/core.ts", import.meta.url), "utf8");

test("update rejects IDs that do not belong to the requested table", () => {
  assert.match(source, /const normalizedId = ctx\.db\.normalizeId\(args\.table, args\.id\);/);
  assert.match(source, /ctx\.db\.get\(args\.table, normalizedId\)/);
  assert.match(source, /ctx\.db\.patch\(args\.table, normalizedId/);
});

test("remove rejects IDs that do not belong to the requested table", () => {
  assert.equal((source.match(/ctx\.db\.normalizeId\(args\.table, args\.id\)/g) ?? []).length, 2);
  assert.match(source, /ctx\.db\.delete\(args\.table, normalizedId\)/);
});
