# Review 009: Security Hardening

## Status

Open — 2026-05-19

Branch reviewed: `feature/security-hardening`
- Initial review: `d6e4c66`
- Re-review: `adafa91`

Preview reviewed:
- `https://project-u415a-nvhyy1s1z-jackz1.vercel.app/`

Scope reviewed:
- `lib/api/same-origin.ts` helper and wiring into all mutating API routes.
- `lib/api/idempotency-key.ts` helper and `/api/v1/pay` usage.
- `docs/08-security-hardening.md` attack surface, controls, citations,
  test-proof table, and out-of-scope section.
- Doc alignment in `docs/04-api-design.md`, `docs/06-review-log.md`,
  `docs/07-delivery-checklist.md`, and `README.md`.
- Fresh pass over the branch merged on top of `main`.

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 202 tests
- `npm run build` — pass
- `npm run db:validate` — pass
- `git diff --check` — pass

Re-review verification at `adafa91`:
- `npm run typecheck` — pass
- `npm test` — pass, 206 tests
- `npm run build` — pass
- `npm run db:validate` — pass
- `git diff --check` — pass
- `rg -n '\$queryRaw|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'` — returns one application/test callsite: `lib/payment.ts:183`

Preview smoke:
- `GET /api/v1/healthz` on the Preview URL returns `200`.
- `POST /api/v1/sessions` with no `Origin` returns `200`, sets a secure
  `hfc_session` cookie, and preserves the README cURL path.
- `POST /api/v1/sessions` with `Origin: https://evil.example` returns
  `403 FORBIDDEN_ORIGIN`.
- `POST /api/v1/pay` with a valid session and no `Idempotency-Key` returns
  `400 BAD_REQUEST`.
- `POST /api/v1/pay` with `Idempotency-Key: café` returns `400 BAD_REQUEST`
  with `Idempotency-Key must be printable ASCII`.
- `POST /api/v1/pay` with a valid session, valid key, and
  `Origin: https://evil.example` returns `403 FORBIDDEN_ORIGIN`.
- Browser root page loads on Preview and `Start the quiz` reaches Step 1
  of the funnel.

## Overall Assessment

The two code changes are appropriately small and aimed at real attack paths:
browser-origin mutation and header/log hygiene around `Idempotency-Key`.
The helper tests are focused, and all four mutating routes now call
`checkSameOrigin` before reading cookies or parsing body-specific state.

I found no Blocking code issue. At `adafa91`, N001 is resolved by the
scheme-aware forwarded-proto check and new tests. I001 is improved but still
open: the SQL proof now correctly names the `/pay` raw lock query, but it
also claims a `lib/db.ts` warm-up `$queryRaw` callsite that no longer exists.

## Blocking

None.

## Important

### I001 — Still open: `docs/08` SQL-injection proof table still contradicts the actual repo

- Impact range: `docs/08-security-hardening.md` §2 and §3, the security
  evidence trail, `reviews/resolved-review-items.md`, and the
  interview-facing claim that every security control is falsifiable from the
  repo.
- Risk reason: `adafa91` fixes the original omission of the `/pay`
  `SELECT ... FOR UPDATE`, but the doc now says there are two `$queryRaw`
  callsites: `(1) lib/db.ts pooler warm-up SELECT 1` and `(2)
  lib/payment.ts:183`. The first one is not present in the current repo:
  `lib/db.ts` only creates the Prisma client, and `rg -n
  '\$queryRaw|\$executeRaw' app lib prisma tests --glob '!node_modules'
  --glob '!package-lock.json'` returns only `lib/payment.ts:183`. The code
  remains safe, but the evidence table is still not reproducible as written.
  `reviews/resolved-review-items.md` repeats the same "two callsites" claim,
  so the resolution log currently overstates the fix as well.
- Suggested fix: Rewrite the SQL-injection proof to match the actual repo:
  application/test code has exactly one raw SQL callsite,
  `lib/payment.ts:183`, and it uses Prisma's tagged-template form with
  `${sessionId}` bound as a prepared-statement parameter. Remove the
  nonexistent `lib/db.ts` warm-up claim from `docs/08` and from
  `reviews/resolved-review-items.md`, or add a real warm-up call only if the
  app actually needs it. The better fix is docs-only.

References:
- `docs/08-security-hardening.md:45`
- `docs/08-security-hardening.md:78`
- `reviews/resolved-review-items.md:792`
- `lib/payment.ts:183`
- `lib/db.ts:11`

## Nice-to-have

### N001 — Resolved: same-origin helper is scheme-aware when `x-forwarded-proto` is present

- Impact range: `lib/api/same-origin.ts`, `tests/lib/api/same-origin.test.ts`,
  `docs/04-api-design.md`, and `docs/08-security-hardening.md`.
- Risk reason: The helper name and docs call this a same-origin guard, but
  the implementation compares only `new URL(origin).host` to the receiving
  host. `Origin: http://app.example.com` would pass for a receiving HTTPS
  host if the host matches. In the Vercel deployment, `Secure` cookies,
  HSTS, and `SameSite=Lax` make this low-risk for the demo, but it is not
  technically a full origin comparison and there is no regression test for
  scheme mismatch.
- Suggested fix: Either compare full origin using the forwarded protocol
  (`x-forwarded-proto` / `req.url` fallback) and add a scheme-mismatch test,
  or deliberately rename the wording in docs to "same-host origin guard" so
  the control does not overstate what it enforces.
- Resolution: `adafa91` adds scheme comparison when `x-forwarded-proto` is
  present, keeps the no-header host-only fallback documented for cURL/local
  dev, and adds four tests covering scheme mismatch, scheme match,
  comma-separated forwarded-proto chains, and fallback behavior. The docs now
  describe the conditional scheme behavior instead of implying an unqualified
  full-origin check.

References:
- `lib/api/same-origin.ts:40`
- `lib/api/same-origin.ts:61`
- `tests/lib/api/same-origin.test.ts:88`
- `docs/04-api-design.md:53`
- `docs/08-security-hardening.md:46`

## Recommendation

Fix the remaining I001 docs-proof mismatch before merging. Once `docs/08`
and `reviews/resolved-review-items.md` describe the actual raw SQL surface,
this branch should be safe to merge from the security-hardening review
perspective.
