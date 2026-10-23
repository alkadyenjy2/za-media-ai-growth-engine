import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../convex/publicLead.ts", import.meta.url), "utf8");

test("public lead failures return a stable client-safe message instead of internal Convex errors", () => {
  assert.match(source, /leadJsonResponse\(\s*\{\s*ok:\s*false,\s*error:\s*"Lead intake failed"\s*\}/);
  assert.doesNotMatch(source, /error:\s*error instanceof Error\s*\?\s*error\.message/);
});
