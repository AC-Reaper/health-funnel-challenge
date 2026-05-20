import { cookies, headers } from "next/headers";

/**
 * Build an absolute URL for server-side fetches of our own API from RSC.
 *
 * Trust model:
 *
 * 1. If `APP_ORIGIN` is set, we use it verbatim. This is the
 *    recommended production posture — the origin is pinned by ops,
 *    not derived from request-controlled headers.
 *
 * 2. Otherwise we fall back to `x-forwarded-host` / `x-forwarded-proto`
 *    (Vercel/proxy-friendly), then `host`, then `VERCEL_URL`, then
 *    `localhost:3000`. This preserves the existing cURL/local-dev
 *    behaviour and is the path the seeded `.env.example` documents.
 *
 * `APP_ORIGIN` is parsed lazily on first use and validated via the
 * URL constructor; a malformed value throws synchronously the first
 * time an RSC tries to fetch internally (fail-fast on boot in prod).
 */
let appOriginCache: string | null | undefined;

function resolveAppOrigin(): string | null {
  if (appOriginCache !== undefined) return appOriginCache;
  const raw = process.env.APP_ORIGIN;
  if (!raw) {
    appOriginCache = null;
    return null;
  }
  // Throws on malformed URL — surfaces as 500 on first RSC fetch
  // rather than silently falling back to forwarded headers.
  const url = new URL(raw);
  // Reject schemes that parse but can't address an HTTP origin
  // (e.g. `javascript:`, `data:` → `url.origin === "null"`). Without
  // this, a misconfigured APP_ORIGIN would produce obscure fetch
  // failures instead of an obvious fail-fast.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `APP_ORIGIN must be an http(s) origin; got protocol "${url.protocol}"`,
    );
  }
  appOriginCache = url.origin;
  return appOriginCache;
}

/** Test-only seam — resets the cached APP_ORIGIN parse. */
export function _resetAppOriginCacheForTests(): void {
  appOriginCache = undefined;
}

export async function internalUrl(path: string): Promise<string> {
  const pinned = resolveAppOrigin();
  if (pinned) return `${pinned}${path}`;

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}${path}`;
}

export async function forwardedCookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}
