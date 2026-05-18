# Review 006: Day-3 Submit / Result / Pay

## Status

Resolved — 2026-05-19

Branch reviewed: `feature/assessment-result-api` at `d79959c`

Scope reviewed:
- T-301: `lib/health/calculator.ts`, `lib/validation/assessment.ts`
- T-302: `POST /api/v1/sessions/me/submit`, `lib/result-repo.ts`
- T-303: `GET /api/v1/results/me`, `lib/serializers/result.ts`
- T-304: `POST /api/v1/pay`, `lib/payment.ts`
- Minimal browser pages: `/pay`, `/results`
- Day-3 docs and memory updates

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 160 tests
- `npm run build` — pass

## Overall Assessment

The Day-3 branch is directionally strong. The core loop now exists:
server-side calculator, submitted result snapshot, free-vs-paid result
serializers, and a mock payment transaction with same-key replay plus
already-paid no-op semantics. The two-serializer design is a good
interview signal, and the recorded Supabase smoke covers the main happy
path.

Do not merge yet. The branch still misses a committed regression test for
the exact Day-3 idempotency claims the project rules call out, and there
are two calculation/validation edge cases worth fixing before Day 4 UI
starts building on this surface.

## Blocking

### B001 — Day-3 idempotency is live-smoked but not committed as regression tests

- Impact range: `POST /api/v1/sessions/me/submit`, `POST /api/v1/pay`, `lib/result-repo.ts`, `lib/payment.ts`, `tests/**`, final README/DoD proof.
- Risk reason: `AGENTS.md` explicitly requires idempotency tests for `/submit` and `/pay`, and `PROJECT_BRIEF.md` says each `/api/v1/*` endpoint should have integration coverage. Current tests cover the calculator, full-assessment schema, result serializers, and the pure `decidePaymentAction` tree, but there is no committed test that proves `submitAssessment` returns the same result on replay, no committed test for the `P2002` submit race path, and no committed test that `processPayment` keeps exactly one `payment` row for same-key replay and already-paid/new-key no-op. The task-board live smoke is useful, but it is not a repeatable artifact a reviewer can run after a refactor.
- Suggested fix: Add committed tests before merge. For `/submit`, cover first submit, replay returns the same `resultId` without recompute, and incomplete assessment rejection if route-level testing is feasible. For `/pay`, cover first insert+entitlement flip, same `Idempotency-Key` replay returning the original payment, and already-paid/new-key returning paid entitlement without inserting a second row. If a real DB test harness is too heavy for Day 3, extract a small injectable repository/transaction seam so Vitest can exercise the state transitions without Supabase; keep live smoke as an additional check, not the only proof.

References:
- `AGENTS.md:86-87`
- `PROJECT_BRIEF.md:74-85`
- `docs/04-api-design.md:231-233`
- `docs/04-api-design.md:327-343`
- `tests/lib/payment.test.ts:20-55`
- `memory/task-board.md:41`

## Important

### I001 — `/submit` re-validates bounds but not the final weight × goal coherence rule

- Impact range: `POST /api/v1/sessions/me/submit`, `FULL_ASSESSMENT_SCHEMA`, calculator input trust, result snapshots created from legacy or inconsistent rows.
- Risk reason: The step API prevents normal users from saving an incoherent `mainGoal`/`weightKg`/`targetWeightKg` combination, but `/submit` is the final server-trusted calculation boundary. It currently only checks that fields are present and within scalar bounds. If an inconsistent row exists from pre-fix data, manual DB edits, or a future route regression, `/submit` will compute and persist a result snapshot anyway. That weakens the "server-side calculation is trustworthy" scoring point.
- Suggested fix: Reuse `checkWeightCoherence` at submit time or add a `.superRefine()` to `FULL_ASSESSMENT_SCHEMA` for the same cross-field rule used by the step API. Return `422 VALIDATION_ERROR` before `compute()`, with field messages on `mainGoal` / `weightKg` / `targetWeightKg`. Add tests for `lose_weight` with target >= current, `gain_weight` with target <= current, and `maintain` outside ±2kg.

References:
- `lib/validation/assessment.ts:16-30`
- `app/api/v1/sessions/me/submit/route.ts:91-108`
- `lib/assessment.ts:86-113`

### I002 — Truncated long curves jump to the target at week 52

- Impact range: `lib/health/calculator.ts`, paid full-result payload, `curvePoints`, calculator fixture tests.
- Risk reason: For goals that are not "unrealistic" by the 30% rule but still take more than `MAX_CURVE_WEEKS`, `computeCurveAndDate` caps `weeks` at 52, then forces the last point to `target` because `w === weeks`. Example: `weightKg=250`, `targetWeightKg=175` is exactly 30% delta, so it is not short-circuited, but at 0.5 kg/week the 52-week point should be 224 kg, not 175 kg. The response simultaneously says the date is unknown and shows an impossible one-year curve reaching the goal.
- Suggested fix: Only snap the final point to `target` when `fullWeeks <= MAX_CURVE_WEEKS`. When the curve is truncated, emit `start + weeklyStep * MAX_CURVE_WEEKS` as the final point and keep `predictedTargetDate: null`. Add a boundary test for an exactly-30% change that exceeds 52 weeks.

References:
- `lib/health/calculator.ts:181-193`
- `tests/lib/health/calculator.test.ts:190-194`

## Nice-to-have

### N001 — API doc leak invariant omits one paid-only field the test already bans

- Impact range: `docs/04-api-design.md`, `tests/lib/serializers/result.test.ts`, reviewer-facing paywall proof.
- Risk reason: The test correctly bans `algorithmVersion` from teaser JSON, but the API doc's "Test invariant" list omits it. The implementation is better than the documentation, but a reviewer reading the doc first will not see the full leak-proofing claim.
- Suggested fix: Add `algorithmVersion` to the documented teaser leak invariant.

References:
- `docs/04-api-design.md:299-301`
- `tests/lib/serializers/result.test.ts:61-70`

### N002 — README has a duplicated Day-3 delivery row

- Impact range: `README.md` first impression, final repo polish.
- Risk reason: The status table lists Day 3 twice, once as the real completed row and once as a leftover placeholder. This is minor, but the README is a scoring artifact and duplicate rows make it look less curated.
- Suggested fix: Delete the second Day-3 row or fold it into the completed Day-3 row.

References:
- `README.md:46-52`

### N003 — Minimal `/pay` page checks only cookie signature, not session/result readiness

- Impact range: `/pay` browser route, Day-4 funnel UX, deleted-session and pre-submit browser paths.
- Risk reason: The API is the source of truth, so this is not a security hole. Still, the page can render for a cryptographically valid cookie whose DB session was deleted, or for a session that has not reached the teaser result yet. The button then fails through the API or creates a paid entitlement before the user has a result, which is a slightly odd demo path.
- Suggested fix: In Day 4, render `/pay` based on `GET /api/v1/results/me` or a server DB read: redirect no-session/deleted-session to `/`, show "submit first" for `NOT_SUBMITTED`, and show the pay CTA only for a submitted free session.

References:
- `app/pay/page.tsx:14-32`
- `app/api/v1/pay/route.ts:29-50`

## Re-review — 2026-05-19

Commit reviewed: `7b17949`

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 175 tests
- `npm run build` — pass

### Blocking

None. B001 is resolved: `/submit` and `/pay` now have committed state-machine tests through `SubmitTxOps` and `PaymentTxOps` seams. The tests cover first submit, submit replay/P2002 recovery, session-status flip, first pay, same-key replay, already-paid/new-key no-op, same-key pre-paid recovery, and a P2002 insert race.

### Important

No open Important findings remain.

I001 is resolved: `FULL_ASSESSMENT_SCHEMA.superRefine()` now re-runs the shared weight × goal coherence rule before `/submit` can call `compute()`.

I002 is resolved: truncated curves no longer snap the week-52 point to the final target, and the exactly-30%-delta boundary case is covered.

### Nice-to-have

N001 and N002 are resolved. N003 is accepted as a Day-4 UX deferral because `/pay` is still a placeholder page and the API remains the source of truth.

Merge recommendation:
`feature/assessment-result-api` is clear to merge from the Day-3 review perspective. Day-4 review should revisit the browser `/pay` and `/results` UX once the polished funnel UI lands.
