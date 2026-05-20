# Review 011: Production Hardening

## Status

Resolved — reviewed `feature/production-hardening` at `2dcbee6`; all
four findings (I001, I002, N001, N002) fixed on the same branch.
See `reviews/resolved-review-items.md` → "review-011" for the
per-item resolution + verification. 224 tests green; build no longer
warns about lockfiles.

Original review (Open) reviewed `feature/production-hardening` at `2dcbee6`.

PR URL: https://github.com/AC-Reaper/health-funnel-challenge/pull/new/feature/production-hardening

Scope reviewed:

- Next.js 14.2.x → 15.5.18 upgrade and prod `npm audit --omit=dev`.
- Baseline response headers from `next.config.mjs`.
- `Cache-Control: private, no-store, max-age=0` on personalised and
  error API responses.
- `parseJsonBody()` 16 KB body cap + `413 PAYLOAD_TOO_LARGE`.
- 512-char `User-Agent` truncation.
- `APP_ORIGIN` path for `internalUrl()`.
- Docs alignment in README, `docs/02`, `docs/04`, `docs/08`, memory.

## What I Accept

- The Next 15 migration is materially useful, not vanity churn:
  `npm audit --omit=dev` is clean, `npm ls next postcss` shows
  `next@15.5.18` with `postcss@8.5.15` deduped, and the App Router
  async API migration is reflected in route handlers/pages.
- Global headers are applied by `next.config.mjs:headers()` and local
  `next start` smoke confirms XCTO, XFO, Referrer-Policy,
  Permissions-Policy, and CSP on `/api/v1/healthz`.
- Error responses now inherit no-store through `jsonError()`, and
  success responses use `withNoStore()` on all personalised `/api/v1`
  routes except `/healthz`.
- `/pay` still keeps the submitted-session gate from review-010, so
  this branch does not reopen the paid-state consistency bug.
- Rate limiting is still deferred, but the branch documents the tradeoff
  instead of pretending it is solved. For this challenge timing, that is
  acceptable.

## Verification

- `npm run typecheck` — pass.
- `npm test` — pass, 222 tests.
- `npm run build` — pass. Residual Next warning about multiple
  lockfiles, see N002.
- `npm run db:validate` — pass.
- `git diff --check main...HEAD` — pass.
- `npm audit --omit=dev` — pass, found 0 vulnerabilities.
- Local header smoke with `npm run start -- -p 3011`:
  - `HEAD /api/v1/healthz` returns baseline security headers.
  - `HEAD /api/v1/sessions/me` returns baseline headers plus
    `cache-control: private, no-store, max-age=0`.
  - `GET /api/v1/sessions/me` no-cookie returns the expected
    `NO_SESSION` envelope.

## Findings

### Blocking

None.

### Important

#### I001 — Body-size cap is documented as byte-accurate, but the fallback check is character-length based

- Impact range: Every JSON POST/PATCH route that uses
  `parseJsonBody()`:
  `/api/v1/sessions`, `/api/v1/sessions/me/steps/:stepKey`,
  `/api/v1/sessions/me/submit`, and `/api/v1/pay`.
- Evidence:
  - `lib/api/parse-body.ts:12-16` says the second check re-checks
    actual byte length so a missing/lying `Content-Length` cannot
    bypass the cap.
  - `lib/api/parse-body.ts:75-80` actually checks `text.length`.
  - `docs/08-security-hardening.md:111` repeats the same guarantee.
- Risk reason: `text.length` counts UTF-16 code units, not UTF-8
  request bytes. A multibyte JSON body can stay under 16,384
  characters while exceeding the claimed 16 KB byte cap. Also, because
  the fallback uses `req.text()`, a missing `Content-Length` body is
  still fully read before rejection. The implementation is still a
  useful guard for normal requests, but the security proof currently
  overstates what it enforces.
- Suggested fix: After `req.text()`, compare byte length with
  `Buffer.byteLength(text, "utf8")` or `new TextEncoder().encode(text).length`.
  Add a regression test where a multibyte string has `text.length <=
  MAX_BODY_BYTES` but UTF-8 bytes exceed the cap and must return
  `413 PAYLOAD_TOO_LARGE`. Adjust the comment/docs to say this is a
  post-read cap, with the declared `Content-Length` check serving as the
  cheap early rejection path.

#### I002 — Next 15 upgrade is not recorded as an ADR-level decision

- Impact range: Decision trace and delivery docs: `memory/decisions.md`,
  `docs/02-architecture.md`, and parts of README that still speak from
  the original Next 14 baseline.
- Evidence:
  - `memory/decisions.md:7-15` still says ADR-001 is "Next.js 14 App
    Router + TypeScript" and explicitly decides to use Next.js 14.
  - `docs/02-architecture.md:21-24` still indexes ADR-001 as Next.js 14.
  - `README.md:71` still describes the shipped app skeleton as
    "Next.js 14 App Router skeleton" without noting the later production
    hardening upgrade.
- Risk reason: This project explicitly treats ADRs as immutable and
  authoritative. A major framework-version change made for security is
  a good decision, but leaving ADR-001 stale makes the audit fix look
  ungoverned and weakens the "AI collaboration / architecture judgment"
  evidence.
- Suggested fix: Add a small ADR-015, for example "Framework patch
  baseline: Next.js 15.5.18 for production audit hygiene", with
  `Supersedes ADR-001 version only` or "Amends ADR-001; App Router +
  TypeScript decision remains." Then update the ADR index in
  `docs/02`, README wording, and memory references to say "Next.js 15
  App Router (initially scaffolded on 14, upgraded during
  production-hardening)."

### Nice-to-have

#### N001 — `APP_ORIGIN` should reject non-http(s) schemes explicitly

- Impact range: Server-component internal fetches through
  `lib/internal-fetch.ts:internalUrl()`.
- Evidence: `lib/internal-fetch.ts:23-33` parses
  `process.env.APP_ORIGIN` with `new URL(raw).origin`, but does not
  check the protocol.
- Risk reason: `new URL()` rejects malformed strings, but valid
  non-http schemes can still parse and produce an unusable origin such
  as `null`, leading to obscure RSC fetch failures instead of the
  documented fail-fast behaviour. This is an operator-misconfiguration
  risk, not a user-controlled SSRF path.
- Suggested fix: Validate `url.protocol === "https:" || url.protocol
  === "http:"` and `url.origin !== "null"` before caching. Add one
  unit test for `APP_ORIGIN="javascript:alert(1)"` or `data:text/plain,x`
  rejecting on first use.

#### N002 — Next build warning about multiple lockfiles is still noisy

- Impact range: Local build output and potentially output tracing if an
  evaluator builds from the parent workspace.
- Evidence: `npm run build` passes but Next 15 warns that it inferred
  `/Users/vegtbk/Documents/arkon-tech/package-lock.json` as the
  workspace root while also detecting
  `health-funnel-challenge/package-lock.json`.
- Risk reason: This does not break the deployed app, but it adds noise
  to a final-evaluator build and can make the project look less
  self-contained.
- Suggested fix: If the parent lockfile cannot be removed, set
  `outputFileTracingRoot` in `next.config.mjs` to the repo root so the
  warning disappears. Keep this low-priority; it should not block merge
  if the two Important items are fixed.

