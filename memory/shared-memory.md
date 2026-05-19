# Shared Memory

## Current Project

Health quiz funnel full-stack challenge for Ruiqi Technology (睿迄科技).
5-day delivery. Currently in scaffold + design phase. ADR-001…013 are
Accepted; Day 1 (T-101) is unblocked.

## Final Goal

Deliver a public demo URL, GitHub repo with README, API docs, DB schema
diagram, and an AI collaboration retrospective within 5 days. The
deployed app must walk an anonymous user through the funnel, gate the
result on a mock `POST /api/v1/pay`, and return the full result after
payment.

## Confirmed Tech Stack

- Next.js 14 App Router (UI + API route handlers)
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
- Test suite → `tests/**` (vitest, 175 tests)
- ADR log → `memory/decisions.md` (ADR-001…013 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest reviews → `reviews/review-007-browser-smoke.md` (Preview URL passes full browser smoke; review remains Open only because the production alias was previously stale and has not been re-verified as final URL); `reviews/review-006-day3.md` (Resolved at `7b17949`); `reviews/review-002-api.md` and `reviews/review-003-db.md` are resolved for earlier branches.

## Current Branch

`feature/frontend-funnel` — Day-4 UI/deploy branch with Tailwind landing,
server-bootstrapped `/funnel`, `/pay` readiness gate, `/results` restyle,
and README deploy/browser walkthrough. Local branch head is `0a38880`.
Codex browser-smoked `https://project-u415a.vercel.app/` and
`https://project-u415a-oafjf8eba-jackz1.vercel.app/` on 2026-05-19.
The preview URL now passes the full browser loop: no-cookie `/pay`
redirects to `/`, incomplete sessions show `Finish the quiz first`, and
quiz → teaser → `/pay` → full result works. `reviews/review-007-browser-smoke.md`
remains Open only because the production alias was previously stale and
has not been re-verified as the final submitted URL. `feature/db-schema`,
`feature/session-progress-api`, `feature/funnel-persistence-api`, and
`feature/assessment-result-api` are merged into `main`.

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
