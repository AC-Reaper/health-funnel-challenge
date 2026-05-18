# Review 002: API

## Status

Open — 2026-05-18

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

Merge recommendation: do not merge to `main` until T-102 enables live DB smoke for the session happy path. From the locally verifiable API surface, the prior Blocking item is fixed.
