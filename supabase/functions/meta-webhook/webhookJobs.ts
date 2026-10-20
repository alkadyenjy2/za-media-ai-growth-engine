export async function settleWebhookJobs(
  jobs: Promise<unknown>[],
  requiresRetry = false,
): Promise<{ failedCount: number; shouldRetry: boolean }> {
  const results = await Promise.allSettled(jobs);
  const failedCount = results.filter((result) => result.status === "rejected").length;
  return { failedCount, shouldRetry: failedCount > 0 || requiresRetry };
}
