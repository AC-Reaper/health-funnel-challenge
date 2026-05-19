import type { NextResponse } from "next/server";

import { ERROR_CODES, jsonError } from "./errors";

/**
 * Same-origin guard for state-changing routes.
 *
 * - **No `Origin` header → pass.** Origin is browser-set; cURL,
 *   server-side Node `fetch`, and other non-browser clients omit it.
 *   The README cookie-jar walkthrough relies on this carve-out.
 *   Cross-site browser requests are still bounded by the
 *   `SameSite=Lax` cookie attribute (see `lib/session.ts`).
 * - **`Origin: null` → reject.** Sent from sandboxed iframes /
 *   `data:` URLs / opaque origins. We never expect this.
 * - **Malformed `Origin` (not a URL) → reject.**
 * - **Hostname mismatch vs receiving host → reject.** Comparison uses
 *   `x-forwarded-host` first (Vercel proxy) then `host`. Case-insensitive.
 *
 * Rejection envelope is `403 FORBIDDEN_ORIGIN`.
 */
export function checkSameOrigin(
  req: Request,
  requestId: string,
): { ok: true } | { ok: false; res: NextResponse } {
  const origin = req.headers.get("origin");
  if (!origin) return { ok: true };

  if (origin === "null") return { ok: false, res: forbid(requestId) };

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return { ok: false, res: forbid(requestId) };
  }

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return { ok: true };

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    return { ok: false, res: forbid(requestId) };
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
