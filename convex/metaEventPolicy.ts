/** Pure policy for durable Meta webhook event lifecycle. No I/O or external calls. */
export const PROCESSING_LEASE_MS = 120_000;
export const RETRY_INITIAL_DELAY_MS = 60_000;
export const RETRY_MAX_DELAY_MS = 3_600_000;
export const MAX_TRANSIENT_ATTEMPTS = 5;
export const EVENT_TTL_MS = 2_592_000_000;
export const TERMINAL_RETENTION_MS = 2_592_000_000;
export const BLOCKED_FULL_RETENTION_MS = 7_776_000_000;
/** Proposal only: never apply to production without privacy/legal review and owner approval. */
export const BLOCKED_COMPRESSED_RETENTION_MS = 31_536_000_000;
export const SWEEP_OVERDUE_MS = 15 * 60_000;
export const SWEEP_BATCH_SIZE = 25;
export const AUDIT_RETENTION_MS = 90 * 24 * 60 * 60_000;

/** Full-jitter backoff in [50%, 100%] of the exponential delay; RNG is injectable. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  if (!Number.isFinite(attempt) || attempt < 1) throw new RangeError("attempt must be >= 1");
  const exponent = Math.min(30, Math.floor(attempt) - 1);
  const ceiling = Math.min(RETRY_MAX_DELAY_MS, RETRY_INITIAL_DELAY_MS * 2 ** exponent);
  const sample = random();
  const normalized = Number.isFinite(sample) ? Math.min(1, Math.max(0, sample)) : 0.5;
  return Math.floor(ceiling * (0.5 + normalized * 0.5));
}

export function terminalReasonForExpiredEvent(receivedAt: number, lastVerifiedAt: number | null | undefined): "ttl_expired" | "never_verified" {
  return typeof lastVerifiedAt === "number" && lastVerifiedAt >= receivedAt ? "ttl_expired" : "never_verified";
}

export function isProcessingLeaseExpired(leaseStartedAt: number | null | undefined, now: number): boolean {
  return typeof leaseStartedAt !== "number" || now - leaseStartedAt >= PROCESSING_LEASE_MS;
}

export function shouldRetryTransientFailure(attemptCount: number): boolean {
  return Number.isFinite(attemptCount) && attemptCount >= 0 && attemptCount < MAX_TRANSIENT_ATTEMPTS;
}

export function sweepIsOverdue(input: { lastSweepAt: number | null | undefined; consecutiveFailures: number }, now: number): boolean {
  if (!Number.isFinite(input.consecutiveFailures) || input.consecutiveFailures <= 0) return false;
  if (typeof input.lastSweepAt !== "number") return true;
  return now - input.lastSweepAt >= SWEEP_OVERDUE_MS;
}
