# Review 014: Rate Limit

## Status

Resolved — reviewed `feature/rate-limit` at `b2403a1`; the sole
Nice-to-have N001 (security-proof precision drift) fixed on-branch.
See `reviews/resolved-review-items.md` → "review-014".

Closeout re-review completed at `c5aadc3`.

Original review (Open) reviewed `feature/rate-limit` at `b2403a1`
(`fa4f433` implementation + `b2403a1` docs/memory).

Scope reviewed:

- `lib/api/rate-limit.ts`
- Rate-limit integration in `POST /api/v1/sessions`, step `PATCH`,
  `POST /api/v1/sessions/me/submit`, and `POST /api/v1/pay`
- `prisma/schema.prisma`
- `prisma/migrations/20260521000000_add_rate_limit/migration.sql`
- `tests/lib/api/rate-limit.test.ts`
- ADR-016 and docs/memory updates

## What I Accept

- The scope is correctly narrow for the remaining project time: hot write
  routes only, read routes and `/healthz` untouched.
- The limiter sits after same-origin checks and before JSON parsing /
  business writes, so malformed or unauthenticated write attempts still
  consume the relevant bucket.
- Postgres-backed fixed-window is a reasonable demo-scale choice: shared
  across Vercel instances, no new Upstash/KV dependency, and documented as
  best-effort rather than production-grade bot mitigation.
- The `RateLimitStore` seam matches the existing transaction-seam testing
  style, keeping the decision flow unit-testable without a live database.
- The `rate_limit` table is correctly treated as operational data, not a
  domain entity or a fake subscription/user model.
- Fail-open is acceptable for this interview demo because it prevents a
  limiter storage hiccup from breaking the evaluator's happy path.

## Verification

- `npm run typecheck` — pass.
- `npm test` — pass, 240 tests.
- `npm run build` — pass.
- `npm run db:validate` — pass.
- `git diff --check main...HEAD` — pass.
- Raw-query surface check:
  - `rg -n '\$queryRaw|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'`
  - returns one application/test callsite: `lib/payment.ts:200`.
- Preview smoke against
  `https://project-u415a-ce89c5de9-jackz1.vercel.app/`:
  - repeated no-cookie `POST /api/v1/pay` with same Origin / UA /
    Idempotency-Key returns 401 for the first 15 attempts, then
    `429 RATE_LIMITED`.
  - the 429 response includes `Retry-After`, `Cache-Control:
    private, no-store, max-age=0`, and the standard error envelope.

Closeout verification at `c5aadc3`:

- `npm run typecheck` — pass.
- `npm test` — pass, 240 tests.
- `npm run build` — pass.
- `npm run db:validate` — pass.
- `git diff --check main...HEAD` — pass.
- Raw-query grep still returns exactly one application/test callsite:
  `lib/payment.ts:200`.
- Preview smoke against
  `https://project-u415a-bl5sfipnj-jackz1.vercel.app/`: repeated
  no-cookie `POST /api/v1/pay` with same Origin / UA / Idempotency-Key
  returns `429 RATE_LIMITED` on attempt 16, with `Retry-After` and
  `Cache-Control: private, no-store, max-age=0`.

## Findings

### Blocking

None.

### Important

None.

### Nice-to-have

#### N001 — Security proof has two small precision drifts

- Impact range: `lib/api/rate-limit.ts` comments and
  `docs/08-security-hardening.md` SQL-injection proof.
- Risk reason: The implementation is safe enough for this demo, but the
  written proof is slightly less falsifiable than the code. First,
  `identityHash()` is described as "Salted SHA-256" even though no salt or
  secret pepper is used; it is plain SHA-256 over IP + session id + User
  Agent. Second, `docs/08` still cites the sole raw-query callsite as
  `lib/payment.ts:183`, while the current repo reports it at
  `lib/payment.ts:200`. This does not create a runtime vulnerability, but
  security docs are part of the delivery signal, and stale precision makes
  the review trail look less disciplined.
- Suggested fix: Either change the rate-limit comment to "SHA-256" /
  "hash" or intentionally add a server-side pepper if you want the
  stronger claim. Update `docs/08-security-hardening.md` to cite
  `lib/payment.ts:200`, or avoid hard-coding the line number and rely on
  the `rg` reproducer.

## Final Recommendation

No Blocking, Important, or Nice-to-have findings remain. The branch is
mergeable from the review-014 perspective.
