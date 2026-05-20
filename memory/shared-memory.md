# Shared Memory

## Current Project

Health quiz funnel full-stack challenge for Ruiqi Technology (睿迄科技).
5-day delivery. MVP is merged to `main`; post-MVP security hardening is
review-resolved on `feature/security-hardening` at `bcb4f2a`. ADR-001…016
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
- Test suite → `tests/**` (vitest, 240 tests on `feature/rate-limit`)
- ADR log → `memory/decisions.md` (ADR-001…016 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest reviews → `reviews/review-014-rate-limit.md` (Resolved — N001 precision cleanup fixed on-branch after `b2403a1`); `reviews/review-013-landing-cta.md` (Resolved at `f3ea061`, merged); `reviews/review-012-security-polish.md` (Resolved); `reviews/review-011-production-hardening.md` (Resolved at `06817a5`); earlier reviews are resolved for their branches.

## Current Branch

`feature/rate-limit` — adds rate limiting on the hot write routes
(ADR-016), off `main` @ `bf182d6` (landing-cta + security-polish +
production-hardening + delivery-compliance all merged). Reverses the
earlier "rate limiting deferred" non-goal at Owner's request.

- Postgres-backed best-effort fixed-window limiter
  (`lib/api/rate-limit.ts`) on `POST /sessions`, step `PATCH`,
  `POST /submit`, `POST /pay`. New `rate_limit` operational table +
  migration `20260521000000_add_rate_limit` (5 domain + 1 operational
  table). Owner applies it via `npm run db:deploy` at/before deploy.
- Key = keyed HMAC-SHA256 (peppered with `SESSION_COOKIE_SECRET`) of
  IP + session id + UA per route per 60s window (no raw IP/UA stored).
  Fail-open on store error. `429 RATE_LIMITED` +
  `Retry-After`. Limits/identity: sessions 20, steps 80, submit 15,
  pay 15. Opportunistic prune (~2%) bounds the table.
- Pure helpers + a `RateLimitStore` seam → `tests/lib/api/rate-limit.test.ts`
  (12 cases) exercise the flow with an in-memory store; the Prisma
  upsert adapter is the only I/O. Used Prisma upsert (not raw SQL) to
  keep the docs/08 "exactly one $queryRaw" claim true.
- Docs synced: ADR-016; `docs/08` §3.5 + §5 + changelog; `docs/04`
  429 enforced; `docs/02` §0/§9; `docs/03` §1 operational table;
  `docs/07`; `docs/05` Phase-1 reconciliation; README. Q-007's
  "ADR-016 candidate" wording fixed (ADR-016 is now the limiter).

Verification: `tsc --noEmit` clean, `npm test` 240 green,
`next build` clean, `npx prisma validate` clean, `git diff --check`
clean. Codex review-014: 0 Blocking/Important; the one Nice-to-have
(N001) is fixed on-branch — `identityHash` is now a real keyed HMAC
(peppered with `SESSION_COOKIE_SECRET`, was a plain SHA-256 mislabelled
"salted"), and the `docs/08` `$queryRaw` citation corrected
`lib/payment.ts:183` → `:200`. `reviews/review-014-rate-limit.md` is
Resolved. The branch is mergeable from the review-014 perspective.

Prior post-MVP work (all merged to `main`): state-aware landing CTA
(review-013), security-polish — `poweredByHeader: false` + mock-payment
boundary + CSP-deferral docs (review-012), and production-hardening —
Next 15.5.18, baseline security headers, `Cache-Control: no-store`,
16 KB body cap, UA truncation, `APP_ORIGIN` allowlist (review-011).
Owner sets `APP_ORIGIN=https://project-u415a.vercel.app` on Vercel.

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
