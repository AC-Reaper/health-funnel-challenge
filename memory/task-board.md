# Task Board

Four columns: Todo → In Progress → Review → Done.
Tasks keep their `T-NNN` id (referenced from ADRs and reviews).
Owner is who does the work; reviews follow the AGENTS.md §5 flow.

## Todo

### Day 1 — Foundations (unblocked; ADR-001…013 Accepted)


### Day 2 — Funnel persistence

(All shipped on `feature/funnel-persistence-api`; see Review column.)

### Day 3 — Submit / calculate / gate / pay

(All shipped on `feature/assessment-result-api`; see Review column.)

### Day 4 — UI + deploy

(All shipped and browser-smoked on production; see Done column.)

### Day 5 — Hardening + final review

(T-501..T-505 shipped and final-reviewed on `feature/day5-hardening`;
see Done column.)

## In Progress

(None.)

## Review

- Post-MVP frontend polish — Claude → Codex — `feature/frontend-polish` at `8f6f80a` reviewed in `reviews/review-008-frontend-polish.md`. Scope: single-choice auto-advance + confirm flash, client-only `viewStep`, `LockedPreview`, report-style full result, pay-page polish, 360px sanity. No Blocking findings; 1 Important remains: reset `selecting` after failed single-choice save.

- T-301 / T-302 / T-303 / T-304 — Claude — `feature/assessment-result-api` shipped + review-006 findings addressed (B001 / I001 / I002 / N001 / N002; N003 deferred to Day 4). New files: `lib/health/calculator.ts` (pure, versioned `v1.0.0-mifflin`), `lib/validation/assessment.ts` (composed FULL_ASSESSMENT_SCHEMA), `lib/result-repo.ts` (idempotent submit transaction + P2002 race recovery), `lib/serializers/result.ts` (separate `TeaserResultDTO` / `FullResultDTO` types + leak-tested), `lib/payment.ts` (pure `decidePaymentAction` + transactional `processPayment` covering ADR-006 same-key replay + ADR-012 already-paid no-op + free→paid insert+flip), `app/api/v1/sessions/me/submit/route.ts`, `app/api/v1/results/me/route.ts`, `app/api/v1/pay/route.ts`, `app/pay/{page,PayButton}.tsx`, `app/results/page.tsx`. Tests: `tests/lib/health/calculator.test.ts`, `tests/lib/validation/assessment.test.ts`, `tests/lib/serializers/result.test.ts` (leak invariant), `tests/lib/payment.test.ts`. 108 → 160 tests, all green. `tsc --noEmit` + `next build` clean (9 routes total). Live cookie-jar smoke against Supabase: 11 paths green incl. `/submit` idempotent (same `resultId` on replay), `/results/me` teaser → JSON missing every paid field name, `/results/me` 409 `NOT_SUBMITTED` before submit, `/pay` 400 without `Idempotency-Key`, same-key replay returns same `paymentId`, new-key against paid silently no-ops (Prisma `payment.findMany` shows exactly one row). Awaits Codex review of the Day-3 surface before merge to `main`.

## Done

- 2026-05-18 — Codex — Initialize repository folder structure
- 2026-05-18 — Codex — `reviews/review-000-baseline-readiness.md` (5 Blocking, 4 Important, 2 Nice-to-have)
- 2026-05-18 — Claude — `CLAUDE.md` collaboration protocol created
- 2026-05-18 — Claude — Architecture v1 written to `docs/02-architecture.md`
- 2026-05-18 — Codex — `reviews/review-001-architecture.md` reviewed v1 (5 Blocking, 5 Important, 2 Nice-to-have)
- 2026-05-18 — Claude — Architecture v2 written; ADR-007…010 recorded; review-001 findings resolved in design
- 2026-05-18 — Claude — Full API contract written to `docs/04-api-design.md` v1
- 2026-05-18 — Claude — Repository scaffold upgrade pass: `AGENTS.md`, `PROJECT_BRIEF.md`, `README.md` rewritten; `decisions.md` → ADR style; `task-board.md` → 4-column format; skeleton headers added to `docs/00`, `01`, `03`, `05`, `06`, `07` and `memory/shared-memory.md`
- 2026-05-18 — Codex — Owner sign-off for ADR-001…010; Q-001 resolved; Day 1 unblocked
- 2026-05-18 — Codex — `reviews/review-005-governance-scaffold.md` (0 Blocking, 5 Important, 2 Nice-to-have)
- 2026-05-18 — Claude — review-005 fixes + memory-file format pass (I001–I005, N001–N002)
- 2026-05-18 — Codex — Owner decisions recorded: Q-002 English copy, Q-003 Mifflin-St Jeor formula, Q-006 silent no-op payment replay, ADR-011…013 accepted
- 2026-05-18 — Claude — `git init -b main` + baseline commit (`chore: initialise scaffold and design docs`); `feature/db-schema` branch created per ADR-011
- 2026-05-18 — Claude — `feature/db-schema`: shipped `package.json` + `tsconfig.json` + `.nvmrc` + `.gitignore` + `.env.example` + `.env` + `prisma/schema.prisma` + initial migration (`prisma/migrations/20260518000000_init/migration.sql`) + `migration_lock.toml`. `npm install`, `prisma format`, `prisma validate`, `prisma generate` all pass locally. `docs/03-database-design.md` filled (ER diagram + per-table columns + enum list + index rationale + migration runbook). `README.md` setup section refreshed.
- 2026-05-18 — Codex — `reviews/review-003-db.md` (1 Blocking, 4 Important, 3 Nice-to-have).
- 2026-05-18 — Claude — All 8 review-003 findings adopted on `feature/db-schema`: `Result.bmi` widened to `decimal(5,2)` (B001); partial unique index `payment_one_success_per_session_idx` added as SQL-only DB backstop for ADR-012 (I001); `Session/Assessment.updatedAt` switched to Prisma `@updatedAt` (I002); `Payment.idempotencyKey` → `VarChar(128)` and `Payment.currency` → `Char(3)` (I003); API doc `paymentId` example switched to UUID shape (I004); README status, FK rationale wording, and migration-runbook wording all corrected (N001–N003).
- 2026-05-18 — Codex — Re-reviewed `feature/db-schema` at `cc40d3d`: 0 Blocking, 0 Important, 1 Nice-to-have (N004 stale ER diagram labels). Status: Resolved.
- 2026-05-18 — Claude — Fixed N004 (`decimal_5_2` / `varchar_128` / `char_3` in the Mermaid block).
- 2026-05-18 — Claude — Merged `feature/db-schema` into `main` with `--no-ff` (merge commit `2a56382`); deleted the feature branch.
- 2026-05-18 — Claude — Created `feature/session-progress-api`; shipped T-101 (Next.js 14 App Router skeleton) + T-104 (`lib/session.ts` with HMAC-signed cookies, constant-time signature check, computeCurrentStep helper) + T-105 (3 route handlers). Supporting infrastructure: `lib/db.ts` (Prisma singleton with globalThis hot-reload pattern), `lib/env.ts` (Zod env validation), `lib/api/errors.ts` (error envelope + status helpers mirroring `docs/04 §Error model`), `lib/api/request-id.ts` (`X-Request-Id` echo/mint). `next build` passes; offline smoke tests confirm `/healthz` 200, `/sessions/me` 401 NO_SESSION on missing + tampered cookies.
- 2026-05-18 — Codex — `reviews/review-002-api.md` (1 Blocking, 4 Important, 3 Nice-to-have).
- 2026-05-18 — Owner + Claude — T-102 Supabase project provisioned (region `aws-1-us-east-1`, pooler URL on port 6543, direct URL on port 5432). Password URL-encoded (`/` → `%2F`) and written to local `.env` (gitignored). `npm run db:deploy` applied initial migration cleanly; introspection confirms 4 tables + 8 native enums + partial unique index `payment_one_success_per_session_idx` + FK delete actions (CASCADE on assessment/result, RESTRICT on payment) match `prisma/schema.prisma` and `docs/03-database-design.md`. Cookie-jar smoke test against live DB verified all four paths from review-002 I004.
- 2026-05-18 — Claude — Adopted 7/8 review-002 findings on `feature/session-progress-api`. New: `lib/api/parse-body.ts` + `lib/progress.ts`. Changed: `POST /api/v1/sessions` validates `z.object({}).strict()` (B001); `lib/session.ts`/`lib/db.ts`/`lib/env.ts` now `import "server-only"` (I001); `computeCurrentStep` + `STEP_ORDER` moved to pure `lib/progress.ts` (I001); `ALREADY_PAID` removed from `ERROR_CODES` (I002); `ErrorFields = Record<string, string | string[]>` (I003); `docs/04` canonicalised the session DTO with `createdAt` + `answers:{}` on both endpoints (N001); README env comment now states `SESSION_COOKIE_SECRET` is required from this branch onward with `openssl rand -base64 48` hint (N002); T-105 wording in README/task-board now says code shipped but pending DB smoke + re-review (I004). N003 unit tests deferred to T-203 (Codex's recommendation). `tsc --noEmit` + `next build` pass; cURL matrix verifies `BAD_REQUEST` / `VALIDATION_ERROR` / `INTERNAL_ERROR` envelopes.
- 2026-05-18 — Codex — Live-smoke clearance on `db992ab`: review-002 status flipped to Resolved for T-101/T-104/T-105.
- 2026-05-18 — Claude — Merged `feature/session-progress-api` into `main` with `--no-ff` (merge commit `0bda115`); deleted the feature branch.
- 2026-05-18 — Claude — Created `feature/funnel-persistence-api`; shipped T-201 (Zod step schemas with `.strict()` per step), T-202 (PATCH /sessions/me/steps/:stepKey with first-incomplete-step rule, weight×main_goal coherence check, idempotent upsert, full canonical SessionDTO response; `docs/04 §3` updated), T-203 (vitest + 67 unit tests across cookies / progress / step schemas / parse-body — closes review-002 N003 by ride-along). Five commits, all Conventional. Live cookie-jar smoke against Supabase verified the 13-step happy + sad path matrix.
- 2026-05-18 — Codex — Step-API review on `feature/funnel-persistence-api` at `f1ae3b3`: 1 Blocking (B002 inherited-keys), 3 Important (I005 main_goal flip incoherence, I006 stale session.current_step / updated_at, I007 no route-level state-machine tests), 1 Nice-to-have (N004 build_muscle implicit).
- 2026-05-18 — Claude — Adopted all 5 step-API findings on `feature/funnel-persistence-api`. B002: `isStepKey` switched to `Object.hasOwn` (+ inherited-key test cases). I005: new `checkMainGoalChange` helper + route branch returning 422 with `mainGoal` + `targetWeightKg` field messages. I006: PATCH now runs inside `db.$transaction`, updating `session.current_step` (= computeCurrentStep) and refreshing `session.updated_at` via @updatedAt. I007: pure helpers (`projectAssessment` / `stepIsFilled` / `firstMissingPrereq`) extracted to `lib/assessment.ts`; `tests/lib/assessment.test.ts` adds 41 tests covering them + `checkWeightCoherence` + `checkMainGoalChange`. Route-level integration tests for inherited-key 400 / ALREADY_SUBMITTED 409 deferred; live cookie-jar smoke is the regression gate (note recorded in `resolved-review-items.md`). N004: `docs/04 §3` note pins `build_muscle` to "any direction" + dedicated test. Tests 67 → 108, all green; live Supabase smoke confirms B002 / I005 / I006 end-to-end.
- 2026-05-18 — Codex — Re-reviewed `feature/funnel-persistence-api` closeout at `36f8830`: 0 Blocking / 0 Important / 0 Nice-to-have. review-002-api status flipped to Resolved for the step API surface.
- 2026-05-18 — Claude — Merged `feature/funnel-persistence-api` into `main` with `--no-ff`. Deleted the feature branch.
- 2026-05-19 — Claude — Created `feature/assessment-result-api`; shipped T-301 (pure calculator + FULL_ASSESSMENT_SCHEMA), T-302 (idempotent `POST /sessions/me/submit` + result-repo with P2002 race recovery), T-303 (two-serializer `GET /results/me` with the leak invariant test that asserts `dailyCaloriesKcal` / `predictedTargetDate` / `curvePoints` / `"plan"` / `algorithmVersion` are absent from teaser JSON), T-304 (`POST /api/v1/pay` with `Idempotency-Key` header + single transaction + ADR-012 silent no-op). Day-4 placeholder `/pay` + `/results` browser pages so the loop is closeable from a browser. 7 Conventional Commits. 160 unit tests, all green. Live cookie-jar smoke against Supabase covered the full 11-step happy + sad path matrix; payment table verified to contain exactly one row even after a duplicate-key /pay attempt.
- 2026-05-19 — Codex — `reviews/review-006-day3.md` (1 Blocking, 2 Important, 3 Nice-to-have).
- 2026-05-19 — Claude — Adopted 5/6 review-006 findings on `feature/assessment-result-api`. B001: extracted `SubmitTxOps`/`PaymentTxOps` seams + committed Vitest state-machine tests against in-memory fakes (175 tests). I001: `FULL_ASSESSMENT_SCHEMA.superRefine` runs `checkWeightCoherence` (moved to `lib/health/coherence.ts`); `/submit` rejects incoherent rows before invoking `compute()`. I002: truncated curves no longer snap final point to `target`; new boundary test for `weightKg=250 → 175` at exactly 30%. N001: `docs/04 §5` Test invariant now lists `algorithmVersion`. N002: duplicate Day-3 row removed from `README.md`. N003: deferred to T-401/T-402 (Codex's own Day-4 suggestion). 166 → 175 tests, all green.
- 2026-05-19 — Claude + Owner + Codex — T-401 / T-402 / T-403 / T-404 Day-4 UI + deploy closed. `feature/frontend-funnel` shipped Tailwind landing, six-step `/funnel`, `/pay` readiness gate, `/results` restyle, deploy notes, and browser walkthrough. Production URL `https://project-u415a.vercel.app/` passes Codex review-007 browser smoke: no-cookie `/pay` redirects to `/`, quiz → teaser → `/pay` → full result works. Preview protection issue also resolved. Day 4 is fully closed from review perspective.
- 2026-05-19 — Claude + Codex — T-501 / T-502 / T-503 / T-504 / T-505 Day-5 hardening and final review closed on `feature/day5-hardening` at `f2b37f8`. Server-side cookie TTL, `step_event` audit table + transaction seam/tests, schema diagram, AI collaboration log, README/checklist cleanup, and `reviews/resolved-review-items.md` are all verified. Codex `reviews/review-004-final.md` is Resolved; `typecheck`, 184 tests, `db:validate`, and build pass.
