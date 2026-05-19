# Review 009: Security Hardening

## Status

Open — awaiting Codex.

Branch reviewed: `feature/security-hardening`.

Scope (per `docs/08-security-hardening.md`):

1. **Same-origin guard** — `lib/api/same-origin.ts` wired into all four
   mutating routes. `checkSameOrigin(req, requestId)` returns 403
   `FORBIDDEN_ORIGIN` when `Origin` is present and does not match the
   receiving host; allows when `Origin` is absent (cURL / server-internal
   fetch). Tests in `tests/lib/api/same-origin.test.ts` (7 cases).
2. **`Idempotency-Key` printable-ASCII** — `lib/api/idempotency-key.ts`
   exports `IDEMPOTENCY_KEY_SCHEMA`. `/pay` route swaps inline check for
   the imported schema. Tests in `tests/lib/api/idempotency-key.test.ts`
   (11 cases).
3. **`docs/08-security-hardening.md`** (new) — attack surface, existing
   controls with citations, test-proof table, post-MVP additions
   changelog, intentionally out of scope.
4. **Doc alignment** — `docs/04-api-design.md` Authentication +
   error-model rows; `docs/06-review-log.md` row; `docs/07-delivery-checklist.md`
   Security subsection; README pointer.

Out of scope for this branch (documented in `docs/08` §5):
- Real auth (email / OAuth).
- Real Stripe / webhook signature verification.
- Rate limiting (Upstash / Vercel KV is the production path).
- WAF / captcha / bot detection.
- GDPR endpoints / user-data export.

Verification:
- `npx tsc --noEmit` clean.
- `npm test` 184 → 202 (7 same-origin + 11 idempotency-key cases).
- `npm run build` clean (10 routes; no new pages).
- `npx prisma validate` clean (schema unchanged).

Trigger from `memory/task-board.md`. After Codex returns, Claude will
classify each finding adopt/partial/reject, apply, and record in
`reviews/resolved-review-items.md` before merging.

## Findings

TBD — Codex to fill.

## Recommendations

TBD — Codex to fill.
