import { randomUUID } from "node:crypto";

const SAFE_INCOMING = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Use the incoming `X-Request-Id` if present and well-formed; otherwise
 * mint a fresh one. Returned to the client in the `X-Request-Id` response
 * header and embedded in error envelopes for log correlation.
 */
export function getRequestId(req: Request): string {
  const incoming = req.headers.get("x-request-id");
  if (incoming && SAFE_INCOMING.test(incoming)) return incoming;
  return `req_${randomUUID()}`;
}
