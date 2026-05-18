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
- ADR log → `memory/decisions.md` (ADR-001…013 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest review → `reviews/review-005-governance-scaffold.md`
  (Open; no Blocking; 5 Important addressed this turn)

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
