import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../convex/core.ts", import.meta.url), "utf8");
const updateMutation = source.split("export const update = mutation({")[1]?.split("export const remove = mutation({")[0] ?? "";

test("workspace-scoped updates cannot move a record into another tenant workspace", () => {
  assert.match(updateMutation, /existing[^\n]*workspace_id[^\n]*ws!\._id\.toString\(\)/);
  assert.match(updateMutation, /delete patch\.workspace_id/);
});
