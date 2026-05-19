# Resolved Review Items

Cross-walk from individual review findings to the change that resolved
them. Source-of-truth IDs match the review file that raised them
(`review-NNN-*.md`).

## B002 (partial): Architecture spec was missing

Source: `review-000-baseline-readiness.md`

Resolved in:
- `docs/02-architecture.md` (v2)
- `memory/decisions.md` (ADR-001…010, all Accepted 2026-05-18)

Verification:
Architecture v2 covers stack, route map, server/client responsibilities, persistence flow, calculator boundary, auth/session, payment gate, and failure modes. Owner accepted ADR-001…010.
Status: Resolved in design — implementation pending.

## B004 (partial): API contracts were missing

Source: `review-000-baseline-readiness.md`

Resolved in:
- `docs/04-api-design.md` (v1)

Verification:
Endpoint catalogue, auth model, error envelope, status-code table, and cookie-jar cURL walkthrough are all written. Implementation verification pending Day 1–3.
Status: Resolved in design — implementation pending.

## review-001 §3 Blocking: `/pay` route naming mismatch

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-006)
- `docs/02-architecture.md` §2
- `docs/04-api-design.md` §6, §7

Verification:
Browser route `GET /pay` + API route `POST /api/v1/pay` both present in the API doc. Recorded in ADR-006.
Status: Verified in design 2026-05-18.

## review-001 §3 Blocking: Paid seed session vs cookie auth

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-010)
- `docs/04-api-design.md` README cURL section

Verification:
Pre-seeded paid sessionId dropped. README ships cookie-jar cURL walkthrough that creates → submits → pays → reads in the evaluator's own session.
Status: Verified in design 2026-05-18.

## review-001 §3 Blocking: Step-progression rule

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-008)
- `docs/02-architecture.md` §2
- `docs/04-api-design.md` §3

Verification:
`current_step` recomputed server-side as first incomplete required step. PATCH that skips required earlier step returns `409 STEP_OUT_OF_ORDER` with `firstMissingStep`.
Status: Verified in design 2026-05-18.

## review-001 §2 Important: `step_event` over-design

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-009)
- `docs/02-architecture.md` §3 (marked optional)
- `memory/task-board.md` (T-502 optional, Day 5 only)

Verification:
`step_event` not in Day-1 migration. Day-5 optional task.
Status: Verified in design 2026-05-18.

## review-001 §2 Important: `subscription` + `payment_event` over-design

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-007)
- `docs/02-architecture.md` §3
- `docs/04-api-design.md` (no `subscription` endpoint)

Verification:
Single `payment` table + `session.entitlement_status` + `paid_at`. No `subscription` table.
Status: Verified in design 2026-05-18.

## review-001 §2 Nice-to-have: UUIDv7 + in-memory rate limit

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-004 uses `crypto.randomUUID()`)
- `docs/02-architecture.md` §9 (rate limiting cut, README points to Upstash/Vercel KV as prod path)

Verification:
No UUIDv7 dependency. No in-memory rate limiter in MVP.
Status: Verified in design 2026-05-18.

## review-001 §4 Blocking: Unpaid users may receive paid fields

Source: `reviews/review-001-architecture.md`

Resolved in:
- `docs/02-architecture.md` §5
- `docs/04-api-design.md` §5

Verification:
Two-serializer design. Teaser return type cannot emit paid-only fields. Snapshot test will assert paid field names absent from teaser JSON.
Status: Verified in design 2026-05-18 — implementation test pending (T-303).

## review-001 §4 Blocking: Payment loop must close server-side

Source: `reviews/review-001-architecture.md`

Resolved in:
- `docs/04-api-design.md` §7
- `memory/decisions.md` (ADR-006)

Verification:
`POST /api/v1/pay` runs one transaction: insert `payment` with `ON CONFLICT (session_id, idempotency_key) DO NOTHING`, then UPDATE `session.entitlement_status = 'paid'`. `GET /api/v1/results/me` re-reads entitlement on every call.
Status: Verified in design 2026-05-18 — implementation test pending (T-304).

## review-001 §4 Important: README cookie-jar reproducibility

Source: `reviews/review-001-architecture.md`

Resolved in:
- `docs/04-api-design.md` (cookie-jar cURL block)

Verification:
Block is in API doc; will be copied verbatim into README at T-404 on Day 4.
Status: Verified in design 2026-05-18 — README finalization pending (T-404).

## review-001 §3 Important: Open-question tracking inconsistency

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/open-questions.md`

Verification:
Q-001…Q-006 all present, status fields accurate.
Status: Resolved 2026-05-18.

## review-005 I001: Delivery checklist marked API design as matching shipped endpoints

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `docs/07-delivery-checklist.md`

Verification:
API design row is now unchecked with wording "draft exists; verify after T-105, T-202, T-302, T-303, T-304 ship".
Status: Resolved 2026-05-18.

## review-005 I002: Review flow omitted required "risk reason" field

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `AGENTS.md` §5 step 3

Verification:
Step 3 now requires impact range + risk reason + suggested fix on every finding.
Status: Resolved 2026-05-18.

## review-005 I003: PROJECT_BRIEF said 4 deliverables but listed 5

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `PROJECT_BRIEF.md` §3

Verification:
Section §3 now lists 4 deliverables. The cookie-jar paid demo path is folded into deliverable #1 as proof evidence.
Status: Resolved 2026-05-18.

## review-005 I004: Q-006 payment replay semantics still open

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `memory/open-questions.md` (Q-006 resolved with Owner choice B)
- `memory/decisions.md` (ADR-012 records silent no-op replay semantics)
- `docs/02-architecture.md`
- `docs/04-api-design.md`
- `docs/07-delivery-checklist.md`

Verification:
Already-paid sessions with a new `Idempotency-Key` now silently no-op,
return existing paid entitlement, and do not insert a second `payment` row.
Status: Resolved in design 2026-05-18.

## review-005 I005: docs/02 still used D1–D6 sign-off language

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `docs/02-architecture.md` §0 (now an "Accepted decisions" index referencing ADR-001…013)
- Header status line updated to v2 + decision gate cleared

Verification:
No mention of "awaiting sign-off on D1–D6" remains.
Status: Resolved 2026-05-18.

## review-005 N001: T-106 ownership ambiguity

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `memory/task-board.md` (T-106, T-204, T-505)

Verification:
Wording is now "Claude requests `reviews/review-NNN-*.md`; Codex writes it" — splitting trigger ownership from review authorship.
Status: Resolved 2026-05-18.

## review-003 B001: result.bmi decimal(4,2) overflow on API-admitted boundary

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma` (`Result.bmi` → `Decimal(5,2)`)
- `prisma/migrations/20260518000000_init/migration.sql`
- `docs/03-database-design.md` §3 (Result table)

Verification:
`heightCm=120, weightKg=250` yields BMI ≈ 173.61, which now fits in `decimal(5,2)`. A submit fixture for the boundary will be added in T-301 (Day 3).
Status: Resolved 2026-05-18.

## review-003 I001: payment table missing "one successful payment per session" backstop

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/migrations/20260518000000_init/migration.sql` (appended SQL-only partial unique index `payment_one_success_per_session_idx ON payment(session_id) WHERE status='succeeded'`)
- `prisma/schema.prisma` (documented in the `Payment` model docstring)
- `docs/03-database-design.md` §3 + §5

Verification:
Even if a future `/pay` handler regressed past the application-level `ON CONFLICT` logic, a second `succeeded` row for the same session would fail to insert. `failed` rows remain unconstrained for audit flexibility.
Status: Resolved 2026-05-18.

## review-003 I002: timestamp freshness relied on manual updates

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma` (`Session.updatedAt` and `Assessment.updatedAt` use `@updatedAt`)
- `prisma/migrations/20260518000000_init/migration.sql` (NOT NULL columns; Prisma sets the value on every write)
- `docs/03-database-design.md` §3

Verification:
Every Prisma write — including step edits that leave `current_step` unchanged — now refreshes the timestamp. Raw SQL inserts outside Prisma would need to supply the value explicitly; this is acceptable because every write path in this project goes through Prisma.
Status: Resolved 2026-05-18.

## review-003 I003: payment text fields wider than the API contract

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma` (`Payment.idempotencyKey` → `VarChar(128)`, `Payment.currency` → `Char(3)`)
- `prisma/migrations/20260518000000_init/migration.sql`
- `docs/03-database-design.md` §3 (Payment table)

Verification:
The DB now refuses an idempotency key longer than 128 chars or a currency value that is not exactly 3 chars, regardless of validation regressions.
Status: Resolved 2026-05-18.

## review-003 I004: API example used a prefixed payment id while schema stores UUIDs

Source: `reviews/review-003-db.md`

Resolved in:
- `docs/04-api-design.md` §7 (`paymentId` example now shows a UUID)

Verification:
The doc example matches `payment.id`'s UUID type. No `public_id` column was introduced.
Status: Resolved 2026-05-18.

## review-003 N001: README status was stale for the db-schema branch

Source: `reviews/review-003-db.md`

Resolved in:
- `README.md` (Status section)

Verification:
Status now reads "DB schema and initial migration shipped on `feature/db-schema`; no API or frontend application code yet."
Status: Resolved 2026-05-18.

## review-003 N002: payment FK rationale wording was imprecise

Source: `reviews/review-003-db.md`

Resolved in:
- `docs/03-database-design.md` §3 (Payment table) — reworded to "prevent accidental session deletes from erasing audit data" instead of "must outlive any accidental session delete".

Verification:
Wording now matches `ON DELETE RESTRICT` semantics: the delete is blocked, not bypassed.
Status: Resolved 2026-05-18.

## review-003 N003: migration runbook overstated bit-for-bit parity

Source: `reviews/review-003-db.md`

Resolved in:
- `docs/03-database-design.md` §6 — now reads "matches Prisma's diff output, with two intentional additions: `pgcrypto` prepended, and the partial unique index appended".

Verification:
The committed migration's two extra blocks are explicitly documented.
Status: Resolved 2026-05-18.

## review-003 re-review: Blocking and Important fixes verified

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma`
- `prisma/migrations/20260518000000_init/migration.sql`
- `docs/03-database-design.md`
- `docs/04-api-design.md`
- `README.md`

Verification:
Codex re-reviewed `feature/db-schema` at `cc40d3d` on 2026-05-18. `npm run db:validate`, `npm run db:generate`, `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, and `git diff --check` all pass for the locally verifiable surface. Original review-003 B001 and I001-I004 are resolved. One new docs-only Nice-to-have remains: the ER diagram type labels should be refreshed to match the final schema.
Status: Re-verified by Codex 2026-05-18.

## review-002 B001: POST /api/v1/sessions skipped Zod body validation

Source: `reviews/review-002-api.md`

Resolved in:
- `lib/api/parse-body.ts` (new helper)
- `app/api/v1/sessions/route.ts` (wired through the helper with `z.object({}).strict()`)

Verification:
cURL matrix on `npm run start`: wrong / missing `Content-Type` → 400 `BAD_REQUEST`; malformed JSON → 400 `BAD_REQUEST`; unknown field → 422 `VALIDATION_ERROR` with `fields._: "Unrecognized key(s)..."`; valid `{}` → DB call (500 INTERNAL_ERROR until T-102 Supabase). Helper is reusable by future POST/PATCH handlers per ADR-005.
Status: Resolved 2026-05-18.

## review-002 I001: server-only modules unprotected from client imports

Source: `reviews/review-002-api.md`

Resolved in:
- `lib/session.ts`, `lib/db.ts`, `lib/env.ts` (`import "server-only"` at top)
- `lib/progress.ts` (new pure module — extracted `STEP_ORDER` and `computeCurrentStep` so the future frontend can import them without dragging server code)

Verification:
`next build` passes. Importing any of the three server-only modules from a client component would now fail at build time with a clear error.
Status: Resolved 2026-05-18.

## review-002 I002: ALREADY_PAID error code contradicted ADR-012

Source: `reviews/review-002-api.md`

Resolved in:
- `lib/api/errors.ts` (removed `ALREADY_PAID` from `ERROR_CODES`)

Verification:
`grep -rn ALREADY_PAID lib/ app/ docs/` returns no live code references; only historical mentions remain in `memory/decisions.md` (ADR-006 / ADR-012 rationale) and `memory/open-questions.md` (Q-006 history), which are correct as the historical record.
Status: Resolved 2026-05-18.

## review-002 I003: ErrorFields type too narrow for documented API

Source: `reviews/review-002-api.md`

Resolved in:
- `lib/api/errors.ts` (`ErrorFields = Record<string, string | string[]>`)

Verification:
The future `INCOMPLETE_ASSESSMENT` envelope can now carry `{ missingSteps: ["weight", "activity"] }` (per `docs/04` §4) without ad-hoc stringification or fighting the shared helper.
Status: Resolved 2026-05-18.

## review-002 I004: T-105 marked shipped before live DB verification

Source: `reviews/review-002-api.md`

Resolved in:
- `memory/task-board.md` (Review-column entry now reads "code shipped, awaits DB smoke + Codex re-review"; explicit list of what to verify against a migrated DB)
- `README.md` (Day-1 row now 🟡 for `feature/session-progress-api`, not ✅)
- Live DB smoke test against Supabase (2026-05-18, after T-102 closed)

Verification:
All four paths exercised end-to-end against a migrated Supabase Postgres:
1. `POST /api/v1/sessions` first call → 200 + Set-Cookie + real session row inserted (`session.create` with `@updatedAt`).
2. `POST /api/v1/sessions` second call with the issued cookie → 200, same `sessionId`, cookie re-issued (Max-Age refresh).
3. `GET /api/v1/sessions/me` with the valid cookie → 200 with the canonical DTO (assessment is null → `currentStep:"gender"`, `answers:{}`).
4. After `prisma.session.delete({ where: { id } })`, `GET /api/v1/sessions/me` with the same (still cryptographically valid) cookie → 401 `NO_SESSION` envelope. This is the deleted-session branch Codex specifically flagged.
Status: Resolved 2026-05-18.

## review-002 N001: response shape ahead of API doc

Source: `reviews/review-002-api.md`

Resolved in:
- `docs/04-api-design.md` §1 and §2

Verification:
Both `POST /api/v1/sessions` and `GET /api/v1/sessions/me` now document the canonical session DTO including `createdAt` and `answers` (which is `{}` on a fresh session). The implementation already matched; the doc is now in sync.
Status: Resolved 2026-05-18.

## review-002 N002: README setup comment stale

Source: `reviews/review-002-api.md`

Resolved in:
- `README.md` Setup section

Verification:
`SESSION_COOKIE_SECRET` is now flagged as required from `feature/session-progress-api` onward (`lib/env.ts` enforces min 32 chars at boot), with an `openssl rand -base64 48` hint.
Status: Resolved 2026-05-18.

## review-002 N003: no unit tests for pure session helpers

Source: `reviews/review-002-api.md`

Resolved in:
- `vitest.config.ts` + `tests/setup.ts` + `tests/_shims/server-only.ts` (Vitest 4 setup)
- `tests/lib/session.test.ts` (8 tests: round-trip, tampered sig, wrong-length sig, sig-valid-for-different-sid, malformed base64url, base64-of-non-JSON, missing fields, undefined/empty)
- `tests/lib/progress.test.ts` (8 tests: null assessment, empty row, single-field-gap progression, weight requires both fields, fully populated)
- `tests/lib/validation/steps.test.ts` (covers boundary + enum + integer + `.strict()` for all 6 step schemas)
- `tests/lib/api/parse-body.test.ts` (6 tests: missing/wrong content-type, malformed JSON, schema failure with fields, unknown keys, success)
- `package.json` `test` script

Verification:
67 tests across 4 files, all green via `npm test`. Shipped on `feature/funnel-persistence-api` alongside T-201/T-202.
Status: Resolved 2026-05-18 by T-203.

## review-002 re-review: local API fixes verified

Source: `reviews/review-002-api.md`

Resolved in:
- `lib/api/parse-body.ts`
- `app/api/v1/sessions/route.ts`
- `lib/session.ts`
- `lib/db.ts`
- `lib/env.ts`
- `lib/progress.ts`
- `lib/api/errors.ts`
- `docs/04-api-design.md`
- `README.md`
- `memory/task-board.md`

Verification:
Codex re-reviewed `feature/session-progress-api` at `11098e3` on 2026-05-18. `npm run typecheck` and `npm run build` pass. Local cURL smoke verifies `/healthz` 200, `/sessions/me` 401 for missing/tampered cookies, and `POST /sessions` body-boundary handling: missing JSON content type → 400, malformed JSON → 400, unknown field → 422. Valid `{}` reaches Prisma and returns 500 only because `.env` still points at the placeholder DB; full session happy-path verification remains pending on T-102.
Status: Re-verified locally by Codex 2026-05-18; live DB smoke pending T-102.

## review-002 live smoke: session foundation verified against Supabase

Source: `reviews/review-002-api.md`

Resolved in:
- `memory/task-board.md`
- `memory/claude-notes.md`
- Commit `db992ab`

Verification:
Codex reviewed `db992ab` on 2026-05-18. The recorded live smoke is sufficient for review-002 I004: migration deployed to Supabase; introspection confirmed app tables, native enums, partial unique index, and FK actions; `POST /sessions` create inserted a real row and issued a cookie; `POST /sessions` reuse returned the same `sessionId`; `GET /sessions/me` with the valid cookie returned the canonical fresh-session DTO; deleting the session row and reusing the still-valid signed cookie returned `401 NO_SESSION`.
Status: Re-verified by Codex 2026-05-18. No Blocking or Important findings remain for T-101/T-104/T-105.

## review-002 (step-API) B002: isStepKey accepted inherited Object.prototype keys

Source: `reviews/review-002-api.md` Step API Review section

Resolved in:
- `lib/validation/steps.ts` (`Object.hasOwn(STEP_SCHEMAS, value)`)
- `tests/lib/validation/steps.test.ts` (7 new inherited-key cases)

Verification:
Live Supabase smoke confirms `PATCH /api/v1/sessions/me/steps/toString` and `/__proto__` return 400 `BAD_REQUEST` (previously 500). Unit tests cover toString, constructor, __proto__, hasOwnProperty, valueOf, isPrototypeOf, propertyIsEnumerable.
Status: Resolved 2026-05-18.

## review-002 (step-API) I005: main_goal change could invalidate saved weight pair

Source: `reviews/review-002-api.md` Step API Review section

Resolved in:
- `lib/assessment.ts` (`checkMainGoalChange` pure helper)
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts` (new `stepKey === "main_goal"` branch)
- `docs/04-api-design.md` §3 (symmetric rule documented)
- `tests/lib/assessment.test.ts` (7 cases)

Verification:
Live smoke: after saving `lose_weight + (80, 70)`, `PATCH main_goal` to `gain_weight` or `maintain` returns 422 `VALIDATION_ERROR` with `fields.mainGoal` describing the conflict and `fields.targetWeightKg` pointing at `PATCH /api/v1/sessions/me/steps/weight`. `build_muscle` flip accepted (N004 default).
Status: Resolved 2026-05-18.

## review-002 (step-API) I006: session.current_step and session.updated_at stayed stale

Source: `reviews/review-002-api.md` Step API Review section

Resolved in:
- `lib/assessment.ts` (`upsertAssessmentField` accepts a Prisma transaction client)
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts` (`db.$transaction` wrap)

Verification:
Live `psql`-equivalent snapshot via Prisma after the funnel walkthrough shows `session.current_step = "activity"` (was permanently null) and `session.updated_at - session.created_at ≈ 55 seconds` (matching the time spent PATCH-ing). The assessment upsert and the session update commit together; failure of either rolls both back.
Status: Resolved 2026-05-18.

## review-002 (step-API) I007: T-203 lacked route-level state-machine tests

Source: `reviews/review-002-api.md` Step API Review section

Resolved in (partial):
- `lib/assessment.ts` (extracted pure helpers: `projectAssessment`, `stepIsFilled`, `firstMissingPrereq`)
- `tests/lib/assessment.test.ts` (41 new tests covering each helper + the full `checkWeightCoherence` matrix + `checkMainGoalChange`)
- `tests/lib/validation/steps.test.ts` (inherited-key cases for `isStepKey`)

Deferred:
Route-handler integration tests for "inherited unknown step key → 400" and "submitted session → 409 ALREADY_SUBMITTED" require either a Prisma mocking layer or a test-only Postgres runtime, both outside the MVP budget. Live cookie-jar smoke against Supabase remains the regression gate for those two cases and is documented per branch in `memory/claude-notes.md`. A future polish branch can add `next start` + in-process Supertest if Day-5 slack allows.

Verification:
108 tests across 5 files, all green. Three of the five Codex-listed scenarios are committed as pure-unit tests; the other two are exercised by live cURL smoke in every branch.
Status: Resolved (partial) 2026-05-18.

## review-002 (step-API) N004: build_muscle weight semantics were implicit

Source: `reviews/review-002-api.md` Step API Review section

Resolved in:
- `docs/04-api-design.md` §3 (closing note pins "any direction" with rationale)
- `tests/lib/assessment.test.ts` (dedicated "build_muscle (N004: accepts any direction)" describe block with all three directions, plus parallel cases in `checkMainGoalChange`)

Verification:
The product decision is now visible to reviewers in the API doc; the test block locks it in.
Status: Resolved 2026-05-18.

## review-002 step-API re-review: fixes verified at 36f8830

Source: `reviews/review-002-api.md` Step API Re-review section

Resolved in:
- `lib/validation/steps.ts`
- `lib/assessment.ts`
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts`
- `tests/lib/validation/steps.test.ts`
- `tests/lib/assessment.test.ts`
- `docs/04-api-design.md`
- Commit `36f8830` closeout records

Verification:
Codex re-reviewed closeout commit `36f8830` on 2026-05-18. `npm run typecheck`, `npm test` (108 tests), and `npm run build` all pass. B002 is verified fixed by own-property step-key checking plus inherited-key tests. I005 is verified fixed by symmetric `main_goal` coherence checking. I006 is verified fixed by one transaction that upserts assessment and updates `session.current_step`. I007 remains intentionally partial: pure helper regression tests are committed, while route-handler integration tests are deferred and covered by recorded live Supabase smoke for this MVP branch. N004 is verified fixed in docs and tests.
Status: Re-verified by Codex 2026-05-18. No open Blocking or Important step-API findings remain.

## review-006 B001: /submit and /pay idempotency not committed as regression tests

Source: `reviews/review-006-day3.md`

Resolved in:
- `lib/result-repo.ts` (`SubmitTxOps` seam + `runSubmitTransaction` pure orchestrator + `buildSubmitOpsFromTx` adapter)
- `lib/payment.ts` (`PaymentTxOps` seam + `runPaymentTransaction` pure orchestrator + `buildPaymentOpsFromTx` adapter)
- `tests/lib/result-repo.test.ts` (4 cases: first submit, idempotent replay, P2002 race recovery, session.status flip)
- `tests/lib/payment.test.ts` (4 new state-machine cases on top of the existing 4 decidePaymentAction cases)

Verification:
166 → 175 tests; all green via `npm test`. The fakes faithfully model the `Result.sessionId` UNIQUE and `Payment.(sessionId, idempotencyKey)` UNIQUE constraints and throw a shape-compatible `{code:"P2002"}` error so the production recovery paths are exercised. Live cookie-jar smoke against Supabase continues to run on every branch as an additional check.
Status: Resolved 2026-05-19.

## review-006 I001: /submit re-validates bounds but not weight × goal coherence

Source: `reviews/review-006-day3.md`

Resolved in:
- `lib/health/coherence.ts` (extracted from `lib/assessment.ts` so the rule is reusable outside server-only contexts)
- `lib/validation/assessment.ts` (`FULL_ASSESSMENT_SCHEMA.superRefine` adds issues on `mainGoal`/`weightKg`/`targetWeightKg`)
- `docs/04-api-design.md` §4 (Submit) documents the 422 VALIDATION_ERROR path
- `tests/lib/validation/assessment.test.ts` (5 new cases covering each goal's coherence boundary)

Verification:
The same `checkWeightCoherence` helper now backs both the per-step PATCH guard (review-002 I005) and the /submit final check. A row inserted by any non-step path cannot reach `compute()`.
Status: Resolved 2026-05-19.

## review-006 I002: truncated long curves snapped final point to target

Source: `reviews/review-006-day3.md`

Resolved in:
- `lib/health/calculator.ts` (`computeCurveAndDate` snaps to `target` only when `!isTruncated`)
- `tests/lib/health/calculator.test.ts` (boundary case: weightKg=250, targetWeightKg=175 — exactly 30% delta, not short-circuited, truncated at week 52 to 224 kg, `predictedTargetDate=null`)

Verification:
The contract no longer self-contradicts (date unknown + curve "reaches" goal in one year). Existing realistic-range tests unaffected.
Status: Resolved 2026-05-19.

## review-006 N001: API doc leak invariant omitted algorithmVersion

Source: `reviews/review-006-day3.md`

Resolved in:
- `docs/04-api-design.md` §5 — the documented Test invariant now lists `dailyCaloriesKcal`, `predictedTargetDate`, `curvePoints`, `"plan"`, and `algorithmVersion`.

Verification:
The doc and the existing `tests/lib/serializers/result.test.ts` leak assertion now match.
Status: Resolved 2026-05-19.

## review-006 N002: README had duplicated Day-3 row

Source: `reviews/review-006-day3.md`

Resolved in:
- `README.md` — the leftover Day-3 placeholder row is removed; only the completed Day-3 row remains.

Verification:
`grep "Day 3" README.md` returns exactly one match.
Status: Resolved 2026-05-19.

## review-006 N003: /pay page does not check session/result readiness

Source: `reviews/review-006-day3.md`

Resolved in:
- `app/pay/page.tsx` — server component now fetches `GET /api/v1/results/me` (cookie forwarded, `cache:"no-store"`) and branches: 404/401 → `redirect("/")` (dead cookie); 409 `NOT_SUBMITTED` → "Finish the quiz first" CTA back to `/funnel`; 200 `kind=teaser` → render pay CTA with price/currency sourced from `body.paywall`; 200 `kind=full` → `redirect("/results")`.
- `app/pay/PayButton.tsx` — Tailwind restyle only; `Idempotency-Key` + `crypto.randomUUID()` logic unchanged.
- `lib/internal-fetch.ts` — new helper (`internalUrl` + `forwardedCookieHeader`) used by both `/pay` and `/results` server pages to fetch our own API behind Vercel's proxy.

Verification:
Local manual smoke (deleted-session cookie → redirects to `/`; fresh session with no PATCH → "Finish the quiz first"; submitted free session → pay CTA; paid session → redirects to `/results`). `npm run typecheck`, `npm test` (175 tests), `npm run build` all pass on `feature/frontend-funnel`.
Status: Resolved on `feature/frontend-funnel` (T-402).

## review-006 re-review: Day-3 fixes verified at 7b17949

Source: `reviews/review-006-day3.md` Re-review section

Resolved in:
- `lib/result-repo.ts`
- `lib/payment.ts`
- `lib/health/coherence.ts`
- `lib/validation/assessment.ts`
- `lib/health/calculator.ts`
- `tests/lib/result-repo.test.ts`
- `tests/lib/payment.test.ts`
- `tests/lib/validation/assessment.test.ts`
- `tests/lib/health/calculator.test.ts`
- `docs/04-api-design.md`
- `README.md`
- Commit `7b17949` closeout records

Verification:
Codex re-reviewed closeout commit `7b17949` on 2026-05-19. `npm run typecheck`, `npm test` (175 tests), and `npm run build` all pass. B001 is verified fixed by committed submit/payment state-machine tests using transaction seams. I001 is verified fixed by submit-time `FULL_ASSESSMENT_SCHEMA.superRefine()` coherence checks. I002 is verified fixed by the truncated-curve implementation and boundary test. N001/N002 are fixed in docs. N003 is explicitly deferred to Day-4 browser UX.
Status: Re-verified by Codex 2026-05-19. No open Blocking or Important Day-3 findings remain.

## review-003 (re-review) N004: ER diagram type labels stale after schema fixes

Source: `reviews/review-003-db.md` re-review

Resolved in:
- `docs/03-database-design.md` §2 Mermaid block

Verification:
`RESULT.bmi` is now labelled `decimal_5_2`; `PAYMENT.idempotency_key` is `varchar_128`; `PAYMENT.currency` is `char_3`. Diagram matches the table reference, Prisma schema, and migration SQL.
Status: Resolved 2026-05-18.

## review-005 N002: Day-1 docs risk becoming long-form essays

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `docs/00-product-research.md` (Day-1 guidance block at top)
- `docs/01-requirements.md` (Day-1 guidance block at top)

Verification:
Each doc now opens with a "keep this short" instruction explaining what belongs there vs not.
Status: Resolved 2026-05-18.

## review-007 B002: Preview deployment protected by Vercel login

Source: `reviews/review-007-browser-smoke.md`

Resolved in:
- Vercel deployment configuration for `https://project-u415a-oafjf8eba-jackz1.vercel.app/` (Deployment Protection removed or bypassed)

Verification:
Codex re-smoked the preview URL on 2026-05-19. `/` loads the landing page
with `Start the quiz`; no-cookie `/pay` redirects to `/`; an incomplete
two-step session sees `Finish the quiz first`; completing all six steps
navigates to `/results` teaser; unlock navigates to `/pay`; `Pay $9.99`
returns to `/results` full result with daily calories, predicted finish
date, weekly curve, and algorithm version.
Status: Resolved for preview deployment 2026-05-19.

## review-007 B001: Production URL served pre-frontend placeholder

Source: `reviews/review-007-browser-smoke.md`

Resolved in:
- Production deployment at `https://project-u415a.vercel.app/`

Verification:
Codex re-smoked the production URL on 2026-05-19 after the main deploy.
The root page now loads the Day-4 landing UI with `Start the quiz`;
no-cookie `/pay` redirects to `/`; the six-step quiz reaches `/results`
teaser; unlock navigates to `/pay`; `Pay $9.99` returns to `/results`
full result with daily calories, predicted finish date, weekly curve,
and algorithm version.
Status: Resolved 2026-05-19.

## review-004-final I001: DB / architecture docs described pre-`step_event` schema

Source: `reviews/review-004-final.md`

Resolved in:
- `docs/03-database-design.md` (5-table overview + step_event entry + Day-5 migration in runbook + sanity check `\dt` lists five tables)
- `docs/02-architecture.md` first pass (header status flips to v2-current with ADR-014 note; ADR index gains ADR-014; §3 step_event reworded as shipped; §3 index notes; §7 Day-4 + Day-5 ✅; §8/§9 cleanup)
- `docs/02-architecture.md` follow-up (review-004 re-review I004): §0 heading reads ADR-001…014; §3 schema bullets aligned with `prisma/schema.prisma` (`result.bmi decimal(5,2)`, `payment.idempotency_key varchar(128)`, `payment.currency char(3)`)

Verification:
`grep -n "four tables\|step_event.*defer\|step_event.*may ship\|step_event (optional\|ADR-001…013\|decimal(4,2)\|idempotency_key text\|currency text" docs/02-architecture.md docs/03-database-design.md` returns no matches inside live submission text. ADR-009 reads as Accepted-and-shipped throughout; ADR-014 listed alongside it.
Status: Resolved 2026-05-19 on `feature/day5-hardening` (after the review-004 re-review I004 sweep).

## review-004-final I002: API/auth doc stale after the cookie TTL change

Source: `reviews/review-004-final.md`

Resolved in:
- `docs/04-api-design.md` Header / Authentication / cookie-jar block sections

Verification:
Header status reads "Current" referencing ADR-001…014. Authentication section documents `{sid, iat, sig}` payload, HMAC over `${sid}.${iat}`, 30-day server-side TTL with 60-second skew tolerance, and every `verifyCookie → null → 401 NO_SESSION` trigger. Reference to the fictional `lib/session.resolveCookie(req)` is replaced with `verifyCookie(cookies().get(COOKIE_NAME)?.value)`. The Postman-collection claim at the end of §cURL is removed in favour of the README cookie-jar walkthrough.
Status: Resolved 2026-05-19 on `feature/day5-hardening`.

## review-004-final I003: Final delivery docs/checklist were not submission-ready

Source: `reviews/review-004-final.md`

Resolved in:
- `README.md` (ADR-001…013 → ADR-001…014; Day-3 row drops "awaits Codex re-review"; "Planned branches" list replaced with shipped-branch table including review file + merge commit)
- `docs/07-delivery-checklist.md` (rewritten: removes the never-owned `00-product-research.md` / `01-requirements.md` / Postman / `npm run lint` rows with explicit "out of scope" notes; every shipped engineering / deploy / docs / review row marked ✅ with artefact path; review-004-final remains the only open review row)
- `docs/02-architecture.md` follow-up (review-004 re-review I004): §1 MVP-scope row 6 no longer promises a Postman collection; new "Postman collection" row added to §9 "deliberately not doing"; §10 "Open follow-ups" rewritten as "None for the submitted MVP"; Day-1 historical note clarified to flag that ADR-014 was added on Day 5.

Verification:
`grep -n "Postman collection mirroring it\|Postman collection mirrors\|flesh out Prisma schema\|complete request/response/error contracts" docs/02-architecture.md docs/04-api-design.md README.md docs/07-delivery-checklist.md` returns no matches.
Status: Resolved 2026-05-19 on `feature/day5-hardening` (after the review-004 re-review I004 sweep).

## review-004-final N001: `step_event` write had no committed regression proof

Source: `reviews/review-004-final.md`

Resolved in:
- `lib/step-repo.ts` (new) — `StepsTxOps` structural seam + pure `runStepsTransaction` + `buildStepsOpsFromTx` Prisma adapter + `persistStepPatch` production entry
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts` — calls `persistStepPatch` instead of an inline `db.$transaction`
- `tests/lib/step-repo.test.ts` (new) — 3 cases against an `InMemoryStepsOps`: successful PATCH writes assessment + advances currentStep + appends step_event; weight step records both weightKg + targetWeightKg verbatim in valueJson; throw-on-upsert proves createStepEvent is never reached after the upsert fails.

Verification:
`npm test` reports 181 → 184. Same SubmitTxOps / PaymentTxOps pattern as review-006 B001; production call graph is byte-identical with the in-memory fakes — only the ops implementation differs.
Status: Resolved 2026-05-19 on `feature/day5-hardening`.

## review-004-final re-review I004: docs/02-architecture.md still had final-submission and schema drift

Source: `reviews/review-004-final.md` Re-review section

Resolved in:
- `docs/02-architecture.md` §0 heading (`ADR-001…013` → `ADR-001…014`)
- `docs/02-architecture.md` §1 MVP scope (Postman line reworded to "scoped out — cURL walkthrough is canonical")
- `docs/02-architecture.md` §3 schema bullets aligned with `prisma/schema.prisma`: `result.bmi decimal(5,2)`, `payment.idempotency_key varchar(128)`, `payment.currency char(3)`
- `docs/02-architecture.md` §7 Day-1 historical note rewritten to flag ADR-014 was added on Day 5
- `docs/02-architecture.md` §9 "deliberately not doing" gains an explicit Postman row
- `docs/02-architecture.md` §10 "Open follow-ups" replaced with "None for the submitted MVP"

Verification:
`grep -nE "ADR-001…013|Postman collection (mirroring|mirrors)|decimal\(4,2\)|idempotency_key text|currency text|flesh out Prisma schema|complete request/response/error contracts" docs/02-architecture.md` returns no matches inside live submission text. Re-review marked I001 / I003 as fully resolved alongside this fix.
Status: Resolved 2026-05-19 on `feature/day5-hardening`.

## review-008 I001: auto-advance steps stayed disabled after a failed PATCH

Source: `reviews/review-008-frontend-polish.md`

Resolved in:
- `app/funnel/steps/StepGender.tsx`
- `app/funnel/steps/StepMainGoal.tsx`
- `app/funnel/steps/StepActivity.tsx`

Verification:
Each auto-advance step now tracks a `wasPendingRef` and, in a `useEffect` keyed on `pending`, clears `selecting` whenever `pending` transitions `true → false`. This covers the failure paths Codex flagged: a 422 / 5xx / coherence rejection where the parent sets `pending=false` and `error=msg` without unmounting the step — the user can immediately re-click another option. The transition guard (not a bare `!pending`) keeps the 250ms timer-only window from prematurely resetting `selecting` before `onSave` is even invoked. Activity step also covers the chained `/submit` failure path. Manual smoke: trigger a 5xx on `gender` PATCH (e.g. via DevTools network throttling + offline) → error renders inline → options are clickable again without refresh. Codex re-reviewed `c974fbb` on 2026-05-19: `npm run typecheck`, `npm test` (184 tests), `npm run build`, and `npm run db:validate` pass; Preview smoke on `https://project-u415a-doh7rtyig-jackz1.vercel.app/` passes the auto-advance → teaser → pay → full-result path.
Status: Resolved 2026-05-19 on `feature/frontend-polish` at `c974fbb`.

## review-009 I001: docs/08 SQL-injection proof contradicted the actual `$queryRaw` surface

Source: `reviews/review-009-security-hardening.md`

Resolved in:
- `docs/08-security-hardening.md` §2 "Parameterized SQL" row
- `docs/08-security-hardening.md` §3 "SQL injection via body" row

Verification:
The §2 row now says there is **exactly one** `$queryRaw` callsite in app / lib / prisma / tests — `lib/payment.ts:183`, the ADR-006 per-session lock — and explains that it uses Prisma's **tagged-template** form so `${sessionId}` is bound as a prepared-statement parameter, not string-concatenated. The `sessionId` value comes from `verifyCookie`, not the request body. The §3 row mirrors the same proof and points to the §2 row. The reproducer is the actual `rg -n '\$queryRaw\|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'` invocation, which returns exactly that one site. The code is unchanged (it was always safe); only the doc is now factually accurate. (My first attempt also claimed a nonexistent `lib/db.ts` `SELECT 1` warm-up alongside the lock; the review-009 re-review caught the mistake. The current entry reflects the real surface.)
Status: Resolved 2026-05-19 on `feature/security-hardening` (after the review-009 re-review correction).

## review-009 N001: same-origin guard was host-only; scheme mismatch was untested

Source: `reviews/review-009-security-hardening.md`

Resolved in:
- `lib/api/same-origin.ts` — host comparison unchanged; scheme comparison added, conditional on `x-forwarded-proto` (takes the left-most entry of a comma-separated chain). Falls back to host-only when `x-forwarded-proto` is absent (cURL / local dev) so the README cookie-jar walkthrough still works.
- `tests/lib/api/same-origin.test.ts` — 4 new cases: scheme mismatch with `x-forwarded-proto: https` → 403; matching scheme+host → ok; comma-separated forwarded-proto chain takes left-most entry; no `x-forwarded-proto` → host-only fallback passes mismatched scheme.
- `docs/04-api-design.md` Authentication section — updated to describe both host and conditional scheme checks.
- `docs/08-security-hardening.md` §2 + §3 — updated to describe the full host + scheme guard and add a "Cross-scheme POST" row to the test-proof table.

Verification:
`npm test` reports 202 → 206. `tsc --noEmit` + `next build` clean. The fallback-to-host-only branch is explicit and tested, so the cURL cookie-jar walkthrough remains green.
Status: Resolved 2026-05-19 on `feature/security-hardening`.

## review-010 P1: /pay accepted draft sessions and minted payments before /submit

Source: `feature/delivery-compliance-hardening` (Owner-flagged P1 before requesting review-010)

Resolved in:
- `app/api/v1/pay/route.ts` — inserts a `409 NOT_SUBMITTED` envelope immediately after `findSessionById` when `session.status !== "submitted"`.
- `lib/payment.ts:decidePaymentAction` — signature extended to `Pick<Session, "status" | "entitlementStatus">`; new `{ type: "not_submitted" }` action returned on draft.
- `lib/payment.ts:runPaymentTransaction` — switches on `not_submitted` and throws defensively, so the orchestrator cannot mint a payment row against an unsubmitted session even if the route gate regresses.
- `tests/lib/payment.test.ts` — 4 existing pure cases refreshed with `status: "submitted"`; 3 new pure cases under "session not submitted" (draft+free+no row, draft+free+existing row, draft+paid impossible state); 1 new `runPaymentTransaction` defensive throw test.

Verification:
`npm test` reports 206 → 210. `tsc --noEmit` + `npm run build` clean. Before the fix, a draft session with a valid HMAC cookie could POST `/pay`, mint a payment row, and flip `entitlement_status` to `paid` even though no `result` existed (`/results/me` still returned 409 NOT_SUBMITTED so the leak surface was bounded, but the payment-vs-session state diverged). After the fix the route returns 409 NOT_SUBMITTED with `message: "Submit the assessment before payment."`, matching the browser `/pay` page's pre-existing 409 gate via `GET /results/me`.
Status: Resolved 2026-05-20 on `feature/delivery-compliance-hardening`.

## review-010 P0: delivery-compliance README + docs + checklist drift

Source: `feature/delivery-compliance-hardening` (Owner-flagged P0 set)

Resolved in:
- `README.md` — top "Submission info" table (demo URL, GitHub URL, 4 doc links); new §Paid test session with cURL recipe + auth-model note; appended "Submission email template"; test count 181 → 210; branches table refreshed.
- `docs/03-database-design.md` — new §2.1 Logical model mapping (User / Subscription / Payment → shipped representation, with ADR citations).
- `docs/04-api-design.md` — `/pay` endpoint section gains 403 FORBIDDEN_ORIGIN and 409 NOT_SUBMITTED rows; error-model table NOT_SUBMITTED row clarified.
- `docs/07-delivery-checklist.md` — review-009 flipped to [x]; test count 202 → 210; Security subsection rows added for /pay gate + logical model mapping; Submission rows expanded with concrete URLs + email-template pointer + subject pattern.
- `app/results/page.tsx` — one-line "no real charge" footer on the full branch only.

Verification:
README's submission table renders at the top of GitHub's repo view. The §Paid test session block is copy-pasteable against `$BASE`. Email template recipients match `docs/07 §Submission`. Subject template uses the actual 2026-05-20 date format.
Status: Resolved 2026-05-20 on `feature/delivery-compliance-hardening`.

## review-010 I001: delivery checklist + README carried stale review state

Source: `reviews/review-010-delivery-compliance.md`

Resolved in:
- `docs/07-delivery-checklist.md` Product/docs row 5 — rewritten from "shows reviews-001/002/003/006/007 as Resolved and review-004-final open during final closeout" (v1 wording from earlier in the project) to a durable "06-review-log.md is current through review-010-delivery-compliance (reviews 000…010 all Resolved or Resolved-in-design/Closed-informed)".
- `docs/07-delivery-checklist.md` Review section — added `[x] review-010-delivery-compliance.md Resolved` row.
- `README.md` Status line — "ten Codex reviews (000…009) Resolved" → "eleven Codex reviews (000…010) Resolved".

Verification:
`grep -n "review-004-final.*open\|reviews-001/002/003/006/007\|ten Codex reviews" docs/07-delivery-checklist.md README.md` returns no matches inside live submission text.
Status: Resolved 2026-05-20 on `feature/delivery-compliance-hardening`.

## review-010 N001: docs/04 underdocumented when `fields` is present

Source: `reviews/review-010-delivery-compliance.md`

Resolved in:
- `docs/04-api-design.md` §Error model — the `fields` bullet rewritten to enumerate every error code that carries `fields` today: `VALIDATION_ERROR` (per-field messages), `STEP_OUT_OF_ORDER` (`firstMissingStep`), `INCOMPLETE_ASSESSMENT` (`missingSteps`). Notes that endpoint sections below detail the exact shape for the non-`VALIDATION_ERROR` cases.

Verification:
The prose now matches the endpoint-section examples (e.g. `/sessions/me/steps/:stepKey` shows `firstMissingStep`, `/submit` shows `missingSteps`). No code change.
Status: Resolved 2026-05-20 on `feature/delivery-compliance-hardening`.
