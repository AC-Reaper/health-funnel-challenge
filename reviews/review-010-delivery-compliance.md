# Review 010: Delivery Compliance

## Status

Resolved — re-reviewed `a14b90f`; no Blocking, Important, or
Nice-to-have findings remain.

Branch reviewed: `feature/delivery-compliance-hardening`.
Initial head reviewed: `38f6911`.
Re-review head: `a14b90f`.

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
- `npm run typecheck` clean.
- `npm test` — 210 tests green.
- `npm run build` clean.
- `npm run db:validate` clean.
- `git diff --check main...HEAD` clean.
- Live paid-session smoke against `https://project-u415a.vercel.app/`
  passed with the README-style cookie jar flow: create session → six
  steps → submit → pay → `GET /results/me` returns `kind="full"` with
  `dailyCaloriesKcal`, `plan`, and `curvePoints` present. The smoke
  produced a paid session row (`sessionId=ab45ea45-2d02-4e20-a816-23b9c8386a54`,
  `paymentId=37cc17e6-f323-4054-99a5-2fe926f1b4f1`).

Re-review verification at `a14b90f`:
- `npm run typecheck` clean.
- `npm test` — 210 tests green.
- `npm run build` clean.
- `npm run db:validate` clean.
- `git diff --check` clean.

## Findings

### Blocking

None.

### Important

#### I001 — Delivery checklist still contains stale final-review state

- **Impact range:** `docs/07-delivery-checklist.md` final submission gate,
  plus the top-level completion story in `README.md`.
- **Evidence:** `docs/07-delivery-checklist.md:19` says
  `06-review-log.md` shows only reviews 001/002/003/006/007 as resolved
  and `review-004-final` open. That contradicts the current review log:
  `review-004-final`, `review-008-frontend-polish`, and
  `review-009-security-hardening` are already `Resolved`, and this
  branch now adds `review-010-delivery-compliance`. `README.md:55`
  also still says "ten Codex reviews (000…009) Resolved", which will be
  stale once review-010 is addressed and merged.
- **Risk reason:** This is the final checklist the Owner is supposed to
  trust before sending the challenge email. A stale "review-004 open"
  line makes the submission look unfinished even though the actual
  engineering state is much stronger.
- **Suggested fix:** Rewrite the product/docs checklist row to a
  durable statement such as "`06-review-log.md` is current through
  `review-010-delivery-compliance`." Add `review-010` to the checklist
  Review section after fixing this review. Refresh README status to
  mention reviews `000…010` once review-010 is resolved.
- **Re-review at `a14b90f`: Resolved.**
  `docs/07-delivery-checklist.md` now says the review log is current
  through `review-010-delivery-compliance`, the Review section includes
  `review-010-delivery-compliance.md` as `Resolved`, and `README.md`
  now says "eleven Codex reviews (000…010) Resolved." Stale live
  submission text no longer contains the old `review-004-final open`
  or `000…009` wording.

### Nice-to-have

#### N001 — Error-model prose underdocuments `fields`

- **Impact range:** `docs/04-api-design.md` error-model contract.
- **Evidence:** `docs/04-api-design.md:90` says "`fields` is present
  only on `VALIDATION_ERROR`", but current route handlers also attach
  `fields` to `STEP_OUT_OF_ORDER` (`firstMissingStep`) and
  `INCOMPLETE_ASSESSMENT` (`missingSteps`). The same doc later shows
  those examples, so this is an internal contract mismatch rather than
  an implementation bug.
- **Risk reason:** API docs are one of the scoring surfaces. A reviewer
  reading the top error model first may assume structured recovery data
  is unavailable on the 409/422 workflow errors.
- **Suggested fix:** Replace the bullet with something like:
  "`fields` is present when the error has structured field context,
  including `VALIDATION_ERROR`, `STEP_OUT_OF_ORDER`, and
  `INCOMPLETE_ASSESSMENT`. Keys are camelCase request fields unless the
  endpoint documents a meta key such as `firstMissingStep` or
  `missingSteps`."
- **Re-review at `a14b90f`: Resolved.**
  `docs/04-api-design.md` now states that `fields` appears when an
  error carries structured field context, and explicitly enumerates
  `VALIDATION_ERROR`, `STEP_OUT_OF_ORDER`, and
  `INCOMPLETE_ASSESSMENT` with their current field shapes.

## Recommendations

- The `/pay` submitted gate is correctly placed at the route boundary
  and mirrored defensively in `lib/payment.ts`; the four new unit cases
  cover the pure state machine risk.
- The README paid-test recipe now satisfies the original "paid session"
  requirement in the right shape for a cookie-auth design: it prints a
  session id while keeping the signed cookie jar as the actual auth
  credential. The live smoke confirms the recipe works on production.
- No schema, API contract, paywall-leak, or final-documentation
  Blocking/Important issue remains. The branch is mergeable from the
  review-010 delivery-compliance perspective.
