import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/** @type {import('next').NextConfig} */

// Baseline response headers applied to every route. Conservative CSP:
// only frame-ancestors / object-src / base-uri / form-action — no
// script-src/style-src guesses that would break Next's inline runtime.
// Personalised API responses additionally carry `Cache-Control:
// private, no-store, max-age=0` set at the route layer (see
// lib/api/cache-control.ts).
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

const nextConfig = {
  // Don't advertise the framework on every response. Removes the
  // `X-Powered-By: Next.js` header from pages and /api/v1/* alike.
  poweredByHeader: false,
  // Pin the file-tracing root to this package so Next 15 doesn't warn
  // about (and mis-infer) a parent-directory lockfile as the workspace
  // root. The repo is the self-contained tracing root.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
