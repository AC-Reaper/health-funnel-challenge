/**
 * `Cache-Control: private, no-store, max-age=0` header for personalised
 * API responses. Every `/api/v1` route except `/healthz` carries it on
 * both success and error paths so a misconfigured CDN/proxy cannot
 * accidentally cache cookie-scoped payloads (results, teaser/full
 * payment state, step answers) for the wrong session.
 *
 * Convention: `withNoStore` uses `headers.set` (last-write-wins), so
 * callers can safely chain it onto a response that already carries
 * other headers (`x-request-id`, `set-cookie`, …).
 */
export const NO_STORE = "private, no-store, max-age=0";

export function withNoStore<T extends Response>(res: T): T {
  res.headers.set("Cache-Control", NO_STORE);
  return res;
}
