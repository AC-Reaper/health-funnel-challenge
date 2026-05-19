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
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
