# Review 009: Security Hardening

## Status

Open — 2026-05-19

Branch reviewed: `feature/security-hardening` at `d6e4c66`

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

I found no Blocking code issue. The branch should not be merged as-is because
the new security document contains a false SQL-proof claim that is easy for
an evaluator to reproduce.

## Blocking

None.

## Important

### I001 — `docs/08` SQL-injection proof table contradicts the actual repo

- Impact range: `docs/08-security-hardening.md` §2 and §3, the security
  evidence trail, and the interview-facing claim that every security control
  is falsifiable from the repo.
- Risk reason: The doc says the only raw query is
  `db.$queryRaw\`SELECT 1\`` and that the grep command returns one warm-up
  query only. That is not true in the current codebase. `rg -n
  "queryRaw|executeRaw" . -g '!node_modules' -g '!package-lock.json'`
  finds the real payment lock query at `lib/payment.ts:183`:
  `tx.$queryRaw` with `SELECT id FROM "session" WHERE id =
  ${sessionId}::uuid FOR UPDATE`. The code is still safe because Prisma's
  tagged template parameterizes `${sessionId}`, but the doc's proof is
  factually wrong. A reviewer following the citation will see the mismatch
  immediately and may discount the otherwise-good security writeup.
- Suggested fix: Rewrite the SQL-injection rows in `docs/08` to cite the
  actual raw query. The proof should say that all raw SQL goes through
  Prisma tagged templates, the only raw SQL in app code is the
  parameterized `/pay` `SELECT ... FOR UPDATE`, and there is no string
  concatenation of user input. Update the grep reproducer accordingly. No
  application code change is required.

References:
- `docs/08-security-hardening.md:43`
- `docs/08-security-hardening.md:45`
- `docs/08-security-hardening.md:78`
- `lib/payment.ts:183`

## Nice-to-have

### N001 — Same-origin helper is really host-only; scheme mismatch is untested

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

References:
- `lib/api/same-origin.ts:30`
- `lib/api/same-origin.ts:37`
- `tests/lib/api/same-origin.test.ts:19`
- `docs/04-api-design.md:53`
- `docs/08-security-hardening.md:46`

## Recommendation

Fix I001 before merging. N001 can be fixed now because it is small, or left
as an explicitly accepted follow-up if the owner wants to keep this pass
strictly documentation-only after I001.
