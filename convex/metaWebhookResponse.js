/**
 * Build the Meta webhook acknowledgement from per-lead processing results.
 * Any failed retrieval/persistence must return non-2xx so Meta retries delivery.
 * @param {Array<{ok?: boolean, [key: string]: unknown}>} results
 */
export function metaWebhookResponse(results) {
  if (results.some((result) => result?.ok === false)) {
    return Response.json({ accepted: false, processed: results.length, results }, { status: 503 });
  }
  return Response.json({ accepted: true, processed: results.length, results });
}
