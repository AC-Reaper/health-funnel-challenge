import { cookies, headers } from "next/headers";

/**
 * Build an absolute URL for server-side fetches of our own API from RSC.
 * Honours Vercel's forwarded headers and falls back to VERCEL_URL or
 * localhost when none are set (e.g. during `next build` prerender).
 */
export async function internalUrl(path: string): Promise<string> {
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
