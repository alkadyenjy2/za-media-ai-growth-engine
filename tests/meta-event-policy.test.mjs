import test from "node:test";
import assert from "node:assert/strict";
import {
  PROCESSING_LEASE_MS,
  RETRY_INITIAL_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  MAX_TRANSIENT_ATTEMPTS,
  EVENT_TTL_MS,
  TERMINAL_RETENTION_MS,
  BLOCKED_FULL_RETENTION_MS,
  BLOCKED_COMPRESSED_RETENTION_MS,
  retryDelayMs,
  terminalReasonForExpiredEvent,
  isProcessingLeaseExpired,
  shouldRetryTransientFailure,
  sweepIsOverdue,
} from "../convex/metaEventPolicy.ts";

test("retention and lease constants match the approved handoff", () => {
  assert.equal(PROCESSING_LEASE_MS, 120_000);
  assert.equal(RETRY_INITIAL_DELAY_MS, 60_000);
  assert.equal(RETRY_MAX_DELAY_MS, 3_600_000);
  assert.equal(MAX_TRANSIENT_ATTEMPTS, 5);
  assert.equal(EVENT_TTL_MS, 2_592_000_000);
  assert.equal(TERMINAL_RETENTION_MS, 2_592_000_000);
  assert.equal(BLOCKED_FULL_RETENTION_MS, 7_776_000_000);
  assert.equal(BLOCKED_COMPRESSED_RETENTION_MS, 31_536_000_000);
});

test("retry delay is exponential, capped, and jitter is injectable", () => {
  assert.equal(retryDelayMs(1, () => 0), 30_000);
  assert.equal(retryDelayMs(1, () => 1), 60_000);
  assert.equal(retryDelayMs(2, () => 0.5), 90_000);
  assert.equal(retryDelayMs(20, () => 1), RETRY_MAX_DELAY_MS);
});

test("only verification after receipt changes expiration reason", () => {
  const receivedAt = 1_000;
  assert.equal(terminalReasonForExpiredEvent(receivedAt, null), "never_verified");
  assert.equal(terminalReasonForExpiredEvent(receivedAt, 999), "never_verified");
  assert.equal(terminalReasonForExpiredEvent(receivedAt, 1_000), "ttl_expired");
  assert.equal(terminalReasonForExpiredEvent(receivedAt, 2_000), "ttl_expired");
});

test("valid processing lease is protected; expired lease is recoverable", () => {
  assert.equal(isProcessingLeaseExpired(10_000, 129_999), false);
  assert.equal(isProcessingLeaseExpired(10_000, 130_000), true);
  assert.equal(isProcessingLeaseExpired(null, 130_000), true);
});

test("transient retry stops at five attempts", () => {
  assert.equal(shouldRetryTransientFailure(0), true);
  assert.equal(shouldRetryTransientFailure(4), true);
  assert.equal(shouldRetryTransientFailure(5), false);
});

test("sweep overdue clock is injectable and distinguishes never-successful sweep", () => {
  assert.equal(sweepIsOverdue({ lastSweepAt: 0, consecutiveFailures: 1 }, 900_000), true);
  assert.equal(sweepIsOverdue({ lastSweepAt: 1, consecutiveFailures: 0 }, 900_000), false);
  assert.equal(sweepIsOverdue({ lastSweepAt: null, consecutiveFailures: 3 }, 900_000), true);
});
