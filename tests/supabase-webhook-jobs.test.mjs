import assert from "node:assert/strict";
import { settleWebhookJobs } from "../supabase/functions/meta-webhook/webhookJobs.ts";

const ok = await settleWebhookJobs([Promise.resolve("saved"), Promise.resolve("audited")]);
assert.deepEqual(ok, { failedCount: 0, shouldRetry: false });

const failed = await settleWebhookJobs([Promise.resolve("saved"), Promise.reject(new Error("transient DB failure"))]);
assert.deepEqual(failed, { failedCount: 1, shouldRetry: true });

let lateSettled = false;
const slow = new Promise((resolve) => setTimeout(() => { lateSettled = true; resolve("done"); }, 20));
const outcome = await settleWebhookJobs([slow]);
assert.equal(lateSettled, true, "the webhook response must wait for critical jobs to settle");
assert.deepEqual(outcome, { failedCount: 0, shouldRetry: false });
console.log("4 webhook job settlement assertions passed");

const blocked = await settleWebhookJobs([], true);
assert.deepEqual(blocked, { failedCount: 0, shouldRetry: true }, "blocked events without durable replay storage must not be acknowledged");