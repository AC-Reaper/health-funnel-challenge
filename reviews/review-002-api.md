# Review 002: API

## Status

Resolved through T-201/T-202/T-203 step API — 2026-05-18

Branch reviewed: `feature/session-progress-api`

Scope reviewed:
- Next.js 14 App Router skeleton
- `lib/session.ts` signed-cookie helpers and session serializers
- `lib/db.ts`, `lib/env.ts`
- `lib/api/errors.ts`, `lib/api/request-id.ts`
- `GET /api/v1/healthz`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions/me`
- README and memory updates related to T-101/T-104/T-105

Verification run:
- `npm run typecheck` — pass
- `npm run build` — pass
- Local smoke with `next dev -p 3010 -H 127.0.0.1`:
  - `GET /api/v1/healthz` → 200 with `x-request-id`
  - `GET /api/v1/sessions/me` without cookie → 401 `NO_SESSION`
  - `GET /api/v1/sessions/me` with tampered cookie → 401 `NO_SESSION`

Not verified yet:
- `POST /api/v1/sessions` happy path, cookie reuse, and deleted-session cookie behaviour. These touch the database and are blocked on T-102 Supabase provisioning + live migration.

## Overall Assessment

The branch is directionally good: the route surface matches the accepted API
shape, the signed cookie format is simple, the session id is server-generated,
and the health/no-session paths work locally. The implementation is also
appropriately scoped for this branch; no step persistence, calculator, result
gate, or payment code slipped in early.

Do not merge yet. One accepted engineering rule is currently violated:
`POST /api/v1/sessions` does not validate its request body through Zod, so the
first state-changing endpoint already drifts from ADR-005 and the API error
model.

## Blocking

### B001 — `POST /api/v1/sessions` skips Zod/body validation

- Impact range: `app/api/v1/sessions/route.ts`, future API consistency tests, README cURL reproducibility, ADR-005 validation story.
- Risk reason: The route ignores the request body entirely. A malformed JSON body, form-encoded body, array body, or object with unexpected fields would all be treated the same as `{}` once the DB is reachable. That contradicts ADR-005 ("Zod at every API boundary") and `docs/04-api-design.md`, where malformed JSON should be `400 BAD_REQUEST` and schema failures should be `422 VALIDATION_ERROR`. This is exactly the kind of API-professionalism detail interview reviewers notice.
- Suggested fix: Add a small request parser + Zod schema for this endpoint, for example `z.object({}).strict()`. Parse JSON once, map JSON parse failures to `400 BAD_REQUEST`, map non-empty/unknown-field objects to `422 VALIDATION_ERROR`, and keep the successful `{}` path unchanged. Reuse the helper for future POST/PATCH endpoints instead of hand-rolling parsing in every route.

References:
- `app/api/v1/sessions/route.ts:18-47`
- `memory/decisions.md` ADR-005
- `docs/04-api-design.md:68-77`
- `docs/04-api-design.md:87-91`

## Important

### I001 — Server-only modules are not protected from accidental client imports

- Impact range: `lib/session.ts`, `lib/db.ts`, `lib/env.ts`, future frontend branch.
- Risk reason: `lib/session.ts` mixes HMAC signing, env access, Prisma reads, cookie DTOs, and a pure `computeCurrentStep` helper. When the frontend branch arrives, it will be tempting to import DTO types or progress helpers from this file into a client component. In Next.js, that can drag server-only code into a client bundle or fail the build late. More importantly, the module touches `SESSION_COOKIE_SECRET` and Prisma, so the architectural boundary should be explicit.
- Suggested fix: Add `import "server-only";` at the top of `lib/session.ts`, `lib/db.ts`, and `lib/env.ts`. If a pure progress helper is needed client-side later, split it into a separate dependency-free module rather than importing from `lib/session.ts`.

References:
- `lib/session.ts:1-6`
- `lib/db.ts:1-3`
- `lib/env.ts:1-14`

### I002 — Error helper reintroduces the rejected `ALREADY_PAID` semantic

- Impact range: `lib/api/errors.ts`, future `POST /api/v1/pay` implementation, ADR-012 payment replay semantics.
- Risk reason: ADR-012 explicitly superseded the old "already paid returns 409" behaviour. `docs/04-api-design.md` no longer lists `ALREADY_PAID`, but `ERROR_CODES` now includes it. That makes it easy for the payment branch to accidentally return a stale 409-style error instead of the accepted silent no-op.
- Suggested fix: Remove `ALREADY_PAID` from `ERROR_CODES` unless a new ADR reintroduces it. If a future internal branch needs to detect the condition, keep that as internal control flow, not a public error code.

References:
- `lib/api/errors.ts:7-19`
- `memory/decisions.md` ADR-012
- `docs/04-api-design.md:68-79`

### I003 — Error `fields` type is too narrow for the documented API contract

- Impact range: `lib/api/errors.ts`, future step validation, future submit validation.
- Risk reason: `fields` is typed as `Record<string, string>`, but the API design already documents `fields.missingSteps: ["weight","activity"]` for incomplete submit. Zod errors may also need structured values beyond a single string. If the helper stays narrow, later endpoints either fight the shared helper, stringify arrays ad hoc, or drift from the published contract.
- Suggested fix: Define a shared `ErrorFields` type that can represent the documented shapes, e.g. `Record<string, string | string[]>`, and use it in `jsonError`. If the team wants only strings, update `docs/04-api-design.md` now before `/submit` is built.

References:
- `lib/api/errors.ts:23-38`
- `docs/04-api-design.md:221-222`

### I004 — DB-touching session creation is marked shipped before it is actually verified

- Impact range: `POST /api/v1/sessions`, task-board status, merge readiness for `feature/session-progress-api`.
- Risk reason: `typecheck`, `build`, and no-session smoke paths pass, but the primary success path of `POST /api/v1/sessions` still has not run against a migrated Postgres database. This is understandable because T-102 is owner-blocked, but merging while calling T-105 done can hide the biggest integration risk: Prisma create with `@updatedAt`, cookie issuance, cookie reuse, and resume read all working together.
- Suggested fix: Keep T-105 in Review, not Done, until T-102 is complete and the branch is smoke-tested against a real migrated DB: create session, capture `Set-Cookie`, call `POST /sessions` again to reuse, call `GET /sessions/me`, and test a signed cookie pointing to a deleted/nonexistent session returns `401 NO_SESSION`.

References:
- `app/api/v1/sessions/route.ts:18-47`
- `memory/task-board.md:49-52`
- `README.md:37-43`

## Nice-to-have

### N001 — Successful session response shape is slightly ahead of the API doc

- Impact range: `serializeSession`, `POST /api/v1/sessions`, `GET /api/v1/sessions/me`, `docs/04-api-design.md`.
- Risk reason: The implementation returns `answers: {}` and `createdAt` for every session DTO, while the API examples omit `answers` on create and omit `createdAt` on resume. Extra fields are not a runtime bug, but they make later integration tests and README examples ambiguous.
- Suggested fix: Either update `docs/04-api-design.md` to make `createdAt` and `answers` part of the canonical session DTO for both endpoints, or tailor the serializers so create/resume match the examples exactly. The shared DTO is probably fine; just document it.

References:
- `lib/session.ts:160-199`
- `docs/04-api-design.md:95-105`
- `docs/04-api-design.md:118-133`

### N002 — README setup comment is stale on this branch

- Impact range: `README.md` setup instructions.
- Risk reason: The README still says `SESSION_COOKIE_SECRET` is "not yet read by any code on main"; on `feature/session-progress-api`, it is now required by `lib/env.ts` and `lib/session.ts`. A reviewer trying this branch may treat it as optional and hit an env validation error.
- Suggested fix: Update the comment to say the secret is required from `feature/session-progress-api` onward and must be 32+ characters.

References:
- `README.md:83-88`
- `lib/env.ts:6-8`

### N003 — Pure session helpers have no committed regression tests

- Impact range: `signCookie`, `verifyCookie`, `computeCurrentStep`, future auth/resume regressions.
- Risk reason: The core helpers are pure and cheap to test, but current verification is manual smoke only. A small regression in signature verification or first-incomplete-step computation would be easy to miss until a later integration branch.
- Suggested fix: When test tooling lands, add focused unit tests for valid cookie, tampered cookie, malformed cookie, missing assessment → `gender`, partial assessment progression, and complete assessment → `activity`. This can land with T-201/T-203 if adding a test runner on this branch is too much scope.

References:
- `lib/session.ts:36-80`
- `lib/session.ts:104-123`

## Re-review — 2026-05-18

Branch reviewed: `feature/session-progress-api` at `11098e3`

Verification run:
- `npm run typecheck` — pass
- `npm run build` — pass
- Local smoke with `next dev -p 3010 -H 127.0.0.1`:
  - `GET /api/v1/healthz` → 200 with `x-request-id`
  - `GET /api/v1/sessions/me` without cookie → 401 `NO_SESSION`
  - `GET /api/v1/sessions/me` with tampered cookie → 401 `NO_SESSION`
  - `POST /api/v1/sessions` without JSON content type → 400 `BAD_REQUEST`
  - `POST /api/v1/sessions` with malformed JSON → 400 `BAD_REQUEST`
  - `POST /api/v1/sessions` with unknown field → 422 `VALIDATION_ERROR`
  - `POST /api/v1/sessions` with valid `{}` reaches Prisma and returns 500 `INTERNAL_ERROR` only because the local `.env` points at the placeholder DB; live success-path verification remains blocked on T-102

### Blocking

None. B001 is resolved: `POST /api/v1/sessions` now goes through `parseJsonBody` with `z.object({}).strict()` before any DB access.

### Important

No new Important findings.

I001-I003 are resolved:
- I001: server-only modules now import `server-only`; client-safe progress logic was split into `lib/progress.ts`.
- I002: `ALREADY_PAID` is removed from live error codes.
- I003: `ErrorFields` now supports `string | string[]`.

I004 is correctly tracked but not fully closed: README and task-board now say the code is shipped but live DB smoke is still pending. The actual `POST /sessions` happy path, cookie reuse, `GET /sessions/me` with a real cookie, and deleted-session-cookie branch still require T-102 Supabase + migrated DB.

### Nice-to-have

N001 and N002 are resolved. N003 is accepted as a deferred test item for T-203, matching the original suggested fallback. No new Nice-to-have findings.

Pre-live-smoke merge recommendation, now superseded by the live smoke check below: do not merge to `main` until T-102 enables live DB smoke for the session happy path. From the locally verifiable API surface, the prior Blocking item is fixed.

## Live Smoke Check — 2026-05-18

Commit reviewed: `db992ab`

Assessment:
The new commit is documentation/memory only, but the recorded live smoke is sufficient to close the previously pending I004 verification gate for this branch.

Coverage confirmed from `db992ab`:
- `npm run db:deploy` applied the initial migration against Supabase.
- Live DB introspection confirmed the four app tables, eight native enums, `payment_one_success_per_session_idx`, and FK delete actions.
- `POST /api/v1/sessions` first call returned 200, inserted a real session row, and issued a signed cookie.
- `POST /api/v1/sessions` with the issued cookie returned the same `sessionId` and refreshed the cookie.
- `GET /api/v1/sessions/me` with that valid cookie returned 200 and the canonical fresh-session DTO (`currentStep: "gender"`, `answers: {}`).
- After deleting the session row via Prisma, `GET /api/v1/sessions/me` with the still-valid signed cookie returned 401 `NO_SESSION`.

Remaining caveat:
Production cookie flags, especially `Secure`, still need to be observed in the deployed Vercel smoke on Day 4. That is outside this branch and does not block merging `feature/session-progress-api`.

Merge recommendation:
No Blocking or Important findings remain for T-101/T-104/T-105. This branch is clear to merge after Claude records the final task-board status. A full API review is still needed after T-202 lands the step persistence endpoints.

## Step API Review — 2026-05-18

Branch reviewed: `feature/funnel-persistence-api` at `f1ae3b3`

Scope reviewed:
- `lib/validation/steps.ts`
- `lib/assessment.ts`
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts`
- Vitest setup and tests under `tests/**`
- `docs/04-api-design.md`
- README and memory updates related to T-201/T-202/T-203

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 67 tests
- `npm run build` — pass

### Blocking

#### B002 — Inherited object keys can bypass `isStepKey` and turn an unknown step into a 500

- Impact range: `PATCH /api/v1/sessions/me/steps/:stepKey`, `lib/validation/steps.ts`, API error-contract tests.
- Risk reason: `isStepKey` uses `value in STEP_SCHEMAS`. The `in` operator also accepts inherited object keys such as `toString` and `constructor`. A request to `/api/v1/sessions/me/steps/toString` can therefore pass the step-key guard, then `STEP_SCHEMAS[stepKey]` is not a Zod schema and the route can throw a 500 instead of the documented `400 BAD_REQUEST`. This violates the API contract and is exactly the kind of hostile/edge input a reviewer may try.
- Suggested fix: Replace the guard with an own-property check, e.g. `Object.prototype.hasOwnProperty.call(STEP_SCHEMAS, value)` or `Object.hasOwn(STEP_SCHEMAS, value)`. Add tests for inherited keys (`toString`, `constructor`, `__proto__`) and, ideally, a route-level smoke/assertion that those paths return `400 BAD_REQUEST`.

References:
- `lib/validation/steps.ts:93-95`
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts:53-67`

### Important

#### I005 — Changing `main_goal` after saving `weight` can bypass the weight-coherence rule

- Impact range: PATCH step handler, `assessment.main_goal`, `assessment.weight_kg`, future `/submit`, resume/progress consistency.
- Risk reason: The route only runs `checkWeightCoherence` when `stepKey === "weight"`. A user can save `main_goal = lose_weight`, save `weightKg=80,targetWeightKg=70`, then edit `main_goal = gain_weight`. The existing weight answers now contradict the new goal, but the route accepts the edit and the session still appears complete. Future `/submit` may reject it, but `GET /sessions/me` will resume the user at `activity`, not at the now-invalid `weight` step.
- Suggested fix: Re-run weight coherence whenever either `weight` or `main_goal` changes and both fields are present. If the new main goal invalidates the existing weight pair, either reject the main-goal edit with `422 VALIDATION_ERROR` pointing at `mainGoal`/`targetWeightKg`, or clear the weight fields and return `currentStep: "weight"`. For a 5-day MVP, rejecting the edit is simpler and preserves stored answers.

References:
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts:84-100`
- `lib/assessment.ts:71-105`
- `docs/04-api-design.md:169-202`

#### I006 — `session.current_step` and `session.updated_at` remain stale after step saves

- Impact range: `PATCH /api/v1/sessions/me/steps/:stepKey`, `session.current_step`, `session.updated_at`, progress recovery diagnostics and any future metrics/janitor queries.
- Risk reason: The API response recomputes `currentStep` from `assessment`, so the user-facing resume path works. But the database `session.current_step` cache is never updated, and `session.updated_at` does not change because the PATCH only upserts `assessment`. This leaves a modeled progress field permanently stale/null and weakens the database story that the challenge explicitly grades. It also makes the `session(updated_at)` index less meaningful for active-session diagnostics.
- Suggested fix: After a successful assessment upsert, update the session row in the same transaction with `current_step = computeCurrentStep(freshAssessment)` and let Prisma refresh `updatedAt`. If you want `current_step` to remain purely derived, remove or explicitly deprecate the column in a later migration/docs update; keeping a stale cache is the worst middle ground.

References:
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts:102-118`
- `prisma/schema.prisma:100-109`
- `docs/03-database-design.md:96-104`

#### I007 — T-203 lacks committed route-level tests for the PATCH state machine

- Impact range: T-203 acceptance, regression safety for first-incomplete-step and path-param validation.
- Risk reason: The new Vitest suite covers schemas, cookie helpers, progress helpers, and body parsing, but it does not exercise the PATCH route or repository state transitions. The task board says out-of-order rejection and boundary paths are verified through live smoke, which is useful but not a committed regression test. The current `isStepKey` bug also slipped through because tests only checked normal unknown strings, not inherited object keys.
- Suggested fix: Add a small route-level test harness or repository-level tests that cover: inherited unknown step key → 400, `activity` before `age` → 409, editing an earlier saved step remains allowed, changing `main_goal` after weight cannot leave an incoherent assessment, and submitted sessions reject PATCH with `409 ALREADY_SUBMITTED`.

References:
- `tests/lib/validation/steps.test.ts`
- `tests/lib/progress.test.ts`
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts:31-130`

### Nice-to-have

#### N004 — `build_muscle` weight semantics are implicit

- Impact range: `lib/assessment.ts`, docs/API copy, future calculator and UI copy.
- Risk reason: `build_muscle` currently accepts any target-weight direction because the API doc is silent. That may be acceptable, but it is a product decision: the calculator and UI may later imply a surplus/gain-style plan. Leaving this implicit invites inconsistent copy or tests in Day 3/4.
- Suggested fix: Add one sentence to `docs/04-api-design.md` and/or `memory/decisions.md`: either "`build_muscle` accepts any target direction in MVP" or "treat `build_muscle` like gain_weight for target coherence." Then add one focused test for the chosen behavior.

References:
- `lib/assessment.ts:71-80`
- `docs/04-api-design.md:169-202`

## Step API Re-review — 2026-05-18

Commit reviewed: `36f8830`

Scope re-reviewed:
- Closeout records in `memory/task-board.md`, `memory/claude-notes.md`, and `reviews/resolved-review-items.md`
- Fix commits immediately before `36f8830`: `f233114`, `6b428df`, `8a1971c`, `c581272`, `ac99c89`
- Current `lib/validation/steps.ts`
- Current `lib/assessment.ts`
- Current `app/api/v1/sessions/me/steps/[stepKey]/route.ts`
- Current `tests/lib/validation/steps.test.ts` and `tests/lib/assessment.test.ts`
- Current `docs/04-api-design.md` §3

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 108 tests
- `npm run build` — pass

### Blocking

None.

B002 is resolved. `isStepKey` now uses `Object.hasOwn(STEP_SCHEMAS, value)`, so inherited `Object.prototype` names cannot pass the path-param guard. The committed tests cover `toString`, `constructor`, `__proto__`, `hasOwnProperty`, `valueOf`, `isPrototypeOf`, and `propertyIsEnumerable`. The route still maps unknown step keys to `400 BAD_REQUEST` before schema lookup.

### Important

No open Important findings remain for the step persistence surface.

I005 is resolved. The route now checks `main_goal` edits against an already-saved weight pair through `checkMainGoalChange`, returning `422 VALIDATION_ERROR` with actionable `mainGoal` and `targetWeightKg` fields rather than leaving an incoherent assessment.

I006 is resolved. The assessment upsert and `session.current_step` update now run inside one `db.$transaction`; `computeCurrentStep(updatedAssessment)` feeds the cached session column, and Prisma `@updatedAt` refreshes `session.updated_at`.

I007 is accepted as resolved-partial for this 5-day challenge. The missing behavior has been moved into pure, committed helper tests where practical: `projectAssessment`, `stepIsFilled`, `firstMissingPrereq`, `checkWeightCoherence`, and `checkMainGoalChange` are now covered. Full route-handler integration tests remain deferred because they need a Prisma mock layer or test database harness; the branch has live Supabase smoke recorded for the two route-only edges. This is acceptable for the current MVP branch, but Day-3 submit/result/pay review should still add focused leak/idempotency tests where those surfaces are riskier.

### Nice-to-have

None.

N004 is resolved. `docs/04-api-design.md` now explicitly says `build_muscle` accepts any target-weight direction in the MVP, and `tests/lib/assessment.test.ts` locks that behavior for both direct weight validation and `main_goal` changes.

Merge recommendation:
`feature/funnel-persistence-api` is clear to merge from the step-API review perspective. Future review still needs to cover Day-3 `/submit`, `/results/me`, and `/pay` because those endpoints are outside this branch.
