# Shared Memory

## Current Project

Health quiz funnel full-stack challenge for Ruiqi Technology (睿迄科技).
5-day delivery. MVP is merged to `main`; post-MVP security hardening is
review-resolved on `feature/security-hardening` at `bcb4f2a`. ADR-001…015
are Accepted.

## Final Goal

Deliver a public demo URL, GitHub repo with README, API docs, DB schema
diagram, and an AI collaboration retrospective within 5 days. The
deployed app must walk an anonymous user through the funnel, gate the
result on a mock `POST /api/v1/pay`, and return the full result after
payment.

## Confirmed Tech Stack

- Next.js 15 App Router (UI + API route handlers; initially
  scaffolded on Next 14, upgraded during production-hardening)
- TypeScript (strict)
- Prisma + PostgreSQL on Supabase (Free tier)
- Zod at every API boundary
- Vercel (Hobby tier, region iad1)

## Confirmed Delivery Decisions

- Demo copy starts in English.
- Calculator uses Mifflin-St Jeor BMR × activity factor with the accepted
  calorie deficit/surplus and safety floors.
- `/api/v1/pay` silently no-ops for already-paid sessions even if a new
  `Idempotency-Key` is sent; it returns the existing entitlement and does
  not insert a second `payment` row.

## Confirmed MVP Flow

1. Visitor lands on the funnel.
2. `POST /api/v1/sessions` creates an anonymous session and sets a
   signed httpOnly cookie.
3. Visitor completes 6 steps: gender, main_goal, age, height,
   weight + target_weight, activity_level.
4. Each step is persisted via `PATCH /api/v1/sessions/me/steps/:stepKey`
   with Zod validation and the first-incomplete-step rule (ADR-008).
5. Refresh / close / reopen resumes from the first incomplete step.
6. `POST /api/v1/sessions/me/submit` runs the server-side calculator and
   writes a `result` row.
7. `GET /api/v1/results/me` returns a teaser for free sessions
   (BMI + category + headline) or full data for paid sessions.
8. Paywall CTA navigates to `/pay`.
9. `POST /api/v1/pay` requires an `Idempotency-Key`, writes the first
   `payment` row, and flips `session.entitlement_status` to `paid` in
   one DB transaction (ADR-006). Already-paid sessions silently no-op
   on later pay attempts (ADR-012).
10. Visitor reloads the result page and sees the full payload.

## Non-goals

- Real payment provider
- Real authentication (email / OAuth / magic link)
- Recurring `subscription` table or expiry semantics (ADR-007)
- Multi-device or cross-device session resume
- BetterMe UI clone (functional and trustworthy is enough)
- ML / personalised recommendation
- Email / notifications
- Admin dashboard
- Sentry / APM
- Production-grade rate limiting (DB-enforced idempotency only)

## Active Artefacts

- Architecture spec → `docs/02-architecture.md` v2
- API contracts → `docs/04-api-design.md` v1
- DB design → `docs/03-database-design.md`
- Prisma schema → `prisma/schema.prisma`
- Initial migration → `prisma/migrations/20260518000000_init/migration.sql`
- Session library → `lib/session.ts`
- Pure helpers → `lib/progress.ts`, `lib/assessment.ts`
- Step validation → `lib/validation/steps.ts`
- Full-assessment schema → `lib/validation/assessment.ts`
- Calculator → `lib/health/calculator.ts` (algorithmVersion `v1.0.0-mifflin`)
- Result repo → `lib/result-repo.ts`
- Serializers → `lib/serializers/result.ts` (teaser / full DTO types)
- Payment → `lib/payment.ts` (pure `decidePaymentAction` + transactional `processPayment`)
- Route handlers → `app/api/v1/{healthz,sessions,sessions/me,sessions/me/steps/[stepKey],sessions/me/submit,results/me,pay}/route.ts`
- Browser pages → `app/page.tsx`, `app/funnel/**`, `app/pay/{page,PayButton}.tsx`, `app/results/page.tsx`
- Step audit → `step_event` model + `20260519000000_add_step_event`
  migration (ADR-009 accepted on Day 5)
- Test suite → `tests/**` (vitest, 228 tests on `feature/landing-cta`)
- ADR log → `memory/decisions.md` (ADR-001…015 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest reviews → `reviews/review-013-landing-cta.md` (Resolved at `f3ea061`); `reviews/review-012-security-polish.md` (Resolved); `reviews/review-011-production-hardening.md` (Resolved at `06817a5`); earlier reviews are resolved for their branches.

## Current Branch

`feature/landing-cta` — state-aware landing CTA branch on top of
merged security-polish (`main` at `36d78e8`). It fixes the misleading
"Start the quiz" label for returning sessions:

- `app/page.tsx` is now a dynamic server component that reads the
  signed session cookie and renders the CTA that matches actual
  routing behaviour.
- `lib/landing-cta.ts:resolveLandingCta` is the pure decision seam:
  no session / empty draft → Start, draft with progress → Continue,
  submitted → View results.
- `tests/lib/landing-cta.test.ts` covers the four state branches.
- `memory/open-questions.md` Q-007 records the explicit restart/start
  over option as deferred; the visitor-table model is the ADR-016
  candidate if revived.

Inherited from production-hardening:

- Baseline response headers via `next.config.mjs:headers()` —
  XCTO/XFO/Referrer-Policy/Permissions-Policy + a conservative
  `frame-ancestors 'none'; object-src 'none'; base-uri 'self';
  form-action 'self'` CSP that intentionally avoids `script-src`
  guesses.
- `Cache-Control: private, no-store, max-age=0` on every
  personalised + error response (`lib/api/cache-control.ts` +
  `jsonError()`); `/healthz` stays cacheable.
- 16 KB body-size cap with `413 PAYLOAD_TOO_LARGE` enforced in
  `lib/api/parse-body.ts` (declared `Content-Length` checked up
  front + actual body length re-checked).
- 512-char User-Agent truncation at `createSession` ingest
  (`lib/session.ts:truncateUserAgent`).
- `APP_ORIGIN` env allowlist for `lib/internal-fetch.ts:internalUrl()`,
  with a forwarded-host fallback so cURL/local-dev keep working.
  Owner sets `APP_ORIGIN=https://project-u415a.vercel.app` on Vercel
  after merge.

Codex reviewed `f3ea061`: `reviews/review-013-landing-cta.md` is
Resolved with no findings. Verification passes (`tsc --noEmit`,
`npm test` 228, `next build`, `npx prisma validate`,
`git diff --check`). Local cookie-jar smoke confirms landing CTA
states: no cookie → Start, empty draft → Start, draft progress →
Continue, submitted → View results. The branch is mergeable from the
landing-CTA review perspective.

## Code Management

Claude implements on feature branches, Codex reviews before merge, and
Claude fixes review findings on the same branch. Branches:

- `feature/init-docs`
- `feature/db-schema`
- `feature/session-progress-api`
- `feature/assessment-result-api`
- `feature/pay-subscription`
- `feature/frontend-funnel`
- `feature/docs-delivery`

Commit messages use Conventional Commits, for example:

- `feat: add prisma schema for quiz funnel`
- `feat: implement anonymous session api`
- `docs: add api examples and paid session instructions`
