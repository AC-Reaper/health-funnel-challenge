import { cookies, headers } from "next/headers";

/**
 * Build an absolute URL for server-side fetches of our own API from RSC.
 * Honours Vercel's forwarded headers and falls back to VERCEL_URL or
 * localhost when none are set (e.g. during `next build` prerender).
 */
export function internalUrl(path: string): string {
  const h = headers();
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

export function forwardedCookieHeader(): string {
  return cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}
