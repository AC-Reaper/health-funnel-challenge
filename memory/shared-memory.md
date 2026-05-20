# Shared Memory

## Current Project

Health quiz funnel full-stack challenge for Ruiqi Technology (睿迄科技).
5-day delivery. MVP is merged to `main`; post-MVP security hardening is
review-resolved on `feature/security-hardening` at `bcb4f2a`. ADR-001…017
are Accepted.

## Final Goal

Deliver a public demo URL, GitHub repo with README, API docs, DB schema
diagram, and an AI collaboration retrospective within 5 days. The
deployed app must walk an anonymous user through the funnel, gate the
result on a mock payment whose entitlement is granted only by a
signature-verified provider webhook (ADR-017), and return the full
result after payment.

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
- The payment grant (`POST /api/v1/payments/webhook`, ADR-017) silently
  no-ops for already-paid sessions even if a new `idempotencyKey` is
  sent; it returns the existing entitlement and does not insert a second
  `payment` row. Browser `POST /api/v1/payments/checkout` cannot grant.

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
8. Paywall CTA navigates to `/pay`; "Pay" creates a checkout
   (`POST /api/v1/payments/checkout`, no grant) and redirects to the
   `/checkout` mock-provider page.
9. The mock provider signs a `checkout.completed` event and posts
   `POST /api/v1/payments/webhook`, the only grant path: it verifies the
   HMAC signature + amount/currency/status, writes the first `payment`
   row, and flips `session.entitlement_status` to `paid` in one DB
   transaction (ADR-006/017). Already-paid sessions silently no-op on
   later attempts (ADR-012).
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
- Route handlers → `app/api/v1/{healthz,sessions,sessions/me,sessions/me/steps/[stepKey],sessions/me/submit,results/me,payments/checkout,payments/webhook}/route.ts`
- Browser pages → `app/page.tsx`, `app/funnel/**`, `app/pay/{page,PayButton}.tsx`, `app/checkout/{page,ConfirmButton,actions}.ts(x)` (mock provider), `app/results/page.tsx`
- Step audit → `step_event` model + `20260519000000_add_step_event`
  migration (ADR-009 accepted on Day 5)
- Test suite → `tests/**` (vitest, 250 tests on `feature/payment-webhook`)
- ADR log → `memory/decisions.md` (ADR-001…017 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest reviews → `reviews/review-015-payment-webhook.md` (Open at `308f02c`: 0 Blocking, 3 Important, 1 Nice-to-have); `reviews/review-014-rate-limit.md` (Resolved, merged to `main` @ `ffdab50`); `reviews/review-013-landing-cta.md` (Resolved, merged); `reviews/review-012-security-polish.md` (Resolved, merged); earlier reviews are resolved for their branches.

## Current Branch

`feature/payment-webhook` — payment trust boundary (ADR-017), off
`main` @ `ffdab50` (rate-limit + landing-cta + security-polish +
production-hardening + delivery-compliance all merged). Makes the
boundary production-correct as a **simulated** signed webhook (no real
Stripe): the browser checkout can no longer mint `paid`; entitlement is
granted only by a signature-verified provider webhook.

- `POST /api/v1/payments/checkout` (browser, cookie + same-origin +
  rate-limited) creates the order descriptor — **no grant**.
- `POST /api/v1/payments/webhook` is the only grant path. No cookie/
  same-origin; auth = `X-Payment-Signature` HMAC-SHA256 over the raw
  body keyed by new env `PAYMENT_WEBHOOK_SECRET`. Verifies sig (401
  INVALID_SIGNATURE) → `.strict` schema → amount/currency/status (422)
  → reuses the **unchanged** `processPayment` (FOR UPDATE + idempotency).
- `POST /api/v1/pay` removed. Browser one-click: `/pay` → checkout →
  `/checkout` mock-provider page → `confirmMockPayment` server action
  (the only place that signs, server-side) → webhook → `/results`.
- `lib/payment-webhook.ts` (pure sign/verify/validate) +
  `tests/lib/payment-webhook.test.ts` (10 cases). No schema/migration
  change (payment table reused).
- Docs synced: ADR-017; `docs/04` (checkout+webhook replace /pay, 8
  endpoints, 401 INVALID_SIGNATURE); `docs/08` §3.6 + §5 flip +
  attack-surface + changelog; `docs/03` §2.1; `docs/02` §0/§2; README
  (status, tech-stack, §Paid test session rewritten — checkout +
  openssl-signed webhook + wrong-sig→401).

Verification: `tsc --noEmit` clean, `npm test` 250 green, `next build`
clean (/pay gone; payments/checkout + payments/webhook + /checkout
added), `npx prisma validate` clean, `git diff --check` clean. openssl
HMAC recipe verified to byte-match the server `signWebhookPayload`.
New env `PAYMENT_WEBHOOK_SECRET` in local `.env`; Owner sets it on
Vercel. Codex review-015 is Open: fix checkout body validation, webhook
idempotency-key validation, and current-doc route drift before merge.

Prior post-MVP work (all merged to `main`): rate limiting (review-014),
state-aware landing CTA (review-013), security-polish (review-012),
production-hardening (review-011). Owner sets
`APP_ORIGIN=https://project-u415a.vercel.app` on Vercel.

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
