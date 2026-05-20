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
- Test suite → `tests/**` (vitest, 224 tests on `feature/security-polish`)
- ADR log → `memory/decisions.md` (ADR-001…015 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest reviews → `reviews/review-012-security-polish.md` (Open at `ba15dac`, 0 Blocking / 1 Important / 0 Nice-to-have); `reviews/review-011-production-hardening.md` (Resolved at `06817a5`); `reviews/review-010-delivery-compliance.md` (Resolved at `a14b90f`); earlier reviews are resolved for their branches.

## Current Branch

`feature/security-polish` — low-risk tester follow-up branch on top
of merged production-hardening (`main` at `e8bfd14`). It adds one
config-level header hardening and two documentation clarifications:

- `next.config.mjs` sets `poweredByHeader: false`, so pages and
  `/api/v1/*` responses no longer advertise `X-Powered-By: Next.js`.
- `docs/08-security-hardening.md` §5 documents the mock-payment trust
  boundary: browser-callable `/api/v1/pay` intentionally grants
  entitlement for the interview demo; production would use a
  provider webhook verified server-side.
- `docs/08-security-hardening.md` §3.1 documents strict CSP as
  post-MVP because naive `script-src`/nonce changes can break the
  Next App Router without Report-Only/nonce plumbing and full browser
  smoke.

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

Codex reviewed `ba15dac`: security-polish implementation is accepted
and local header smoke confirms `X-Powered-By` is gone while baseline
headers remain. Verification passes (`tsc --noEmit`, `npm test` 224,
`next build`, `npm audit --omit=dev` 0/0, `npx prisma validate`,
`git diff --check`). `reviews/review-012-security-polish.md` is Open
with one Important finding: README still reports 222 tests and reviews
000…010, so its headline/status needs to catch up to review-011 and
the 224-test suite before merge.

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
