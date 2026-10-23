/**
 * Conservatively classify errors from Meta lead retrieval and persistence.
 * Known permanent upstream HTTP errors should not be retried; transient HTTP
 * statuses, network errors, and uncertain persistence failures should be.
 */
export function isRetryableMetaWebhookError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = /^META_LEAD_RETRIEVAL_FAILED:(\d{3}):/.exec(message);
  if (!match) return true;
  const status = Number(match[1]);
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
