# Review 010: Delivery Compliance

## Status

Open — awaiting Codex (optional; Owner may merge directly).

Branch reviewed: `feature/delivery-compliance-hardening`.

Scope (all small, scoped, no new dependencies):

1. **`/pay` submitted gate (P1 status bug)** —
   `app/api/v1/pay/route.ts` returns `409 NOT_SUBMITTED` immediately
   after `findSessionById` when `session.status !== "submitted"`.
   `lib/payment.ts:decidePaymentAction` now also accepts
   `Pick<Session, "status" | "entitlementStatus">` and returns
   `{ type: "not_submitted" }`; `runPaymentTransaction` throws on
   this action defensively. Tests in
   `tests/lib/payment.test.ts` (4 new + 4 refreshed). 206 → 210.

2. **README submission block + Paid test session + email template** —
   top-of-file "Submission info" table; new §Paid test session under
   the demo path with a 5-step cURL that prints sessionId + auth-model
   note; new "Submission email template" appended at the bottom. Test
   count refreshed 181 → 210; branches table refreshed with merged
   commits.

3. **docs/03-database-design.md §2.1 Logical model mapping** — new
   subsection between the Mermaid ER diagram and per-entity tables.
   Maps User / Subscription / Payment vocabulary to the shipped
   schema with ADR citations on every row.

4. **docs/04-api-design.md** — `/pay` section gains rows for `403
   FORBIDDEN_ORIGIN` (from review-009) and `409 NOT_SUBMITTED` (this
   branch); top-level error-model `NOT_SUBMITTED` row clarified to
   note both `/results/me` and `/pay` use it.

5. **`/results` full trust footer** — one-line "Simulated result based
   on your inputs. No real charge was made — this is a 5-day
   interview demo." after the curve details. No layout change.

6. **docs/07-delivery-checklist.md final flip** — review-009 row →
   `[x]`; test count 202 → 210; new Security rows for /pay gate +
   logical model mapping; Submission rows expanded with concrete URLs
   + email-template pointer + subject pattern.

Out of scope:
- Real `user` / `subscription` tables (covered by docs/03 §2.1
  rationale; ADR-004 + ADR-007).
- Frontend marketing visuals beyond the one trust line.

Verification:
- `npx tsc --noEmit` clean.
- `npm test` — 210 tests green.
- `npm run build` clean (10 routes).
- `npx prisma validate` clean (schema unchanged).

## Findings

TBD — Codex to fill if review is requested.

## Recommendations

TBD — Codex to fill if review is requested.
