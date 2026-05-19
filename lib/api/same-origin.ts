import type { NextResponse } from "next/server";

import { ERROR_CODES, jsonError } from "./errors";

/**
 * Same-origin guard for state-changing routes.
 *
 * Comparison surface:
 * - **Host**: `URL(origin).host` vs `x-forwarded-host` (Vercel proxy)
 *   or `host`. Case-insensitive.
 * - **Scheme**: `URL(origin).protocol` vs the receiving scheme,
 *   derived from `x-forwarded-proto` when present (Vercel terminates
 *   TLS upstream so `req.url` shows `http://`). When `x-forwarded-proto`
 *   is **absent**, we cannot reliably know the receiving scheme
 *   (cURL, local dev), so the check falls back to host-only — a
 *   documented trade-off for the cURL cookie-jar walkthrough.
 *
 * Acceptance / rejection rules:
 * - No `Origin` header → pass. Origin is browser-set; cURL,
 *   server-side Node `fetch`, and other non-browser clients omit it.
 *   `SameSite=Lax` already bounds the browser cross-site case for
 *   cookie-bearing requests.
 * - `Origin: null` (sandboxed iframes, `data:` URLs, opaque origins)
 *   → 403.
 * - Malformed `Origin` (not a URL) → 403.
 * - Host mismatch → 403.
 * - Scheme mismatch (only when `x-forwarded-proto` is set) → 403.
 *
 * Rejection envelope: `403 FORBIDDEN_ORIGIN` (see `lib/api/errors.ts`).
 */
export function checkSameOrigin(
  req: Request,
  requestId: string,
): { ok: true } | { ok: false; res: NextResponse } {
  const origin = req.headers.get("origin");
  if (!origin) return { ok: true };

  if (origin === "null") return { ok: false, res: forbid(requestId) };

  let originHost: string;
  let originScheme: string;
  try {
    const parsed = new URL(origin);
    originHost = parsed.host;
    originScheme = parsed.protocol.replace(/:$/, "").toLowerCase();
  } catch {
    return { ok: false, res: forbid(requestId) };
  }

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return { ok: true };

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    return { ok: false, res: forbid(requestId) };
  }

  // Scheme check, only when the receiving scheme can be known.
  // `x-forwarded-proto` can be a comma-separated list (proxy chain);
  // take the left-most entry, which is the original client scheme.
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    const expectedScheme = forwardedProto
      .split(",")[0]
      ?.trim()
      .toLowerCase();
    if (expectedScheme && originScheme !== expectedScheme) {
      return { ok: false, res: forbid(requestId) };
    }
  }

  return { ok: true };
}

function forbid(requestId: string): NextResponse {
  return jsonError({
    status: 403,
    code: ERROR_CODES.FORBIDDEN_ORIGIN,
    message: "Cross-origin request rejected.",
    requestId,
  });
}
