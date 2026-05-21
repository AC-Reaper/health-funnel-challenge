# Shared Memory

## Current Project

Health quiz funnel full-stack challenge for Ruiqi Technology (睿迄科技).
5-day delivery. MVP is merged to `main`; post-MVP security hardening is
review-resolved on `feature/security-hardening` at `bcb4f2a`. ADR-001…019
are Accepted.

## Final Goal

Deliver a public demo URL, GitHub repo with README, API docs, DB schema
diagram, and an AI collaboration retrospective within 5 days. The
deployed app must walk an anonymous user through the funnel, gate the
result on a mock payment, and return the full result after payment.
Entitlement is granted via the shared `processPayment` from either the
brief's directly-callable mock `POST /api/v1/pay` (ADR-018, secret-free)
or the production-grade signature-verified provider webhook (ADR-017)
that the browser UI drives.

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
- The payment grant (shared `processPayment`, reached by mock `POST
  /api/v1/pay` (ADR-018) or the signed `POST /api/v1/payments/webhook`
  (ADR-017)) silently no-ops for already-paid sessions even if a new
  idempotency key is sent; it returns the existing entitlement and does
  not insert a second `payment` row. Browser
  `POST /api/v1/payments/checkout` cannot grant.
- Brief deliverables §五-1b/1c are met: secret-free replayable `/pay`
  cURL + `npm run seed:demo` mints a paid test sessionId that a judge
  diffs via the read-only `GET /api/v1/results/by-session`.

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
   `POST /api/v1/payments/webhook`, the production grant path: it verifies
   the HMAC signature + amount/currency/status, writes the first
   `payment` row, and flips `session.entitlement_status` to `paid` in one
   DB transaction (ADR-006/017). Already-paid sessions silently no-op on
   later attempts (ADR-012). The brief's directly-callable mock
   `POST /api/v1/pay` (ADR-018, same-origin + cookie + `Idempotency-Key`,
   secret-free) is a parallel entry into the **same** transaction for the
   replayable reviewer cURL.
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
- Route handlers → `app/api/v1/{healthz,sessions,sessions/me,sessions/me/steps/[stepKey],sessions/me/submit,results/me,results/by-session,pay,payments/checkout,payments/webhook}/route.ts`
- Demo seed → `scripts/seed-demo.sh` (`npm run seed:demo`) mints a paid + free session against `$BASE`
- Browser pages → `app/page.tsx`, `app/funnel/**`, `app/pay/{page,PayButton}.tsx`, `app/checkout/{page,ConfirmButton,actions}.ts(x)` (mock provider), `app/results/page.tsx`
- Step audit → `step_event` model + `20260519000000_add_step_event`
  migration (ADR-009 accepted on Day 5)
- Test suite → `tests/**` (vitest, 255 tests on `feature/brief-compliance-pay`)
- ADR log → `memory/decisions.md` (ADR-001…019 Accepted)
- Open questions → `memory/open-questions.md` (no open blocker)
- Latest reviews → `reviews/review-016-brief-compliance-pay.md` (Resolved after final confirmation: I001/I002/N001 fixed; branch mergeable); `reviews/review-015-payment-webhook.md` (Resolved at `a220c6b`, merged to `main` @ `10b1dc3`); `reviews/review-014-rate-limit.md` (Resolved, merged to `main` @ `ffdab50`); earlier reviews are resolved for their branches.

## Current Branch

`feature/brief-compliance-pay` — brief-compliance (ADR-018), off `main` @
`10b1dc3` (payment-webhook merged). Re-reading the source brief surfaced
three drifted deliverables; this branch restores them without removing the
webhook:
- Restored `POST /api/v1/pay` as the brief's **secret-free mock callback**
  (same-origin + cookie + `Idempotency-Key`, reusing the unchanged
  `processPayment`). Browser UI still flows checkout→webhook; `/pay` is the
  documented reviewer/cURL grant.
- Added `GET /api/v1/results/by-session?sessionId=<uuid>` — read-only demo
  read, same leak-tested teaser/full serializers, no cookie/secret.
- Added `scripts/seed-demo.sh` (`npm run seed:demo`) → mints a paid + free
  session, prints both ids for §五-1c.
- Docs/memory synced: ADR-018; README §Paid test session rewritten (lead
  with secret-free `/pay` + by-session, webhook kept as bonus); docs/02/03/
  04/07/08 + PROJECT_BRIEF reconciled (two grant paths; ADR-010/017
  superseded-in-part). No schema/migration change; `lib/payment.ts`
  untouched.

**review-016 fixes (ADR-019)** — accepted on closeout and final-confirmed:
- I002: `GET /results/by-session` scoped to demo-seeded sessions via a
  marker User-Agent (`DEMO_SEED_USER_AGENT` + pure `isDemoSeedSession` in
  `lib/session.ts`; seed sends it on session create). A real session id →
  404 (collapsed with not-found). Pure predicate unit-tested (251 → 255).
- N001: `seed:demo` self-verifies paid→full / free→teaser (fail-fast) and
  prints `paymentId` / `entitlementStatus`.
- I001: purged remaining webhook-only claims from README/docs/01/docs/04/
  docs/08 + the webhook route header comment → two-path truth; counts
  refreshed (255 tests, 10 routes, review log through 016). Closeout
  follow-up: `docs/02-architecture.md` stragglers (v1→v2 status blurb,
  Decision gate, §0 header, R8 row, "pre-seeded paid sessionId dropped")
  cleared to ADR-001…019 / two-path truth. Codex final confirmation marks
  review-016 Resolved.

Gates: `tsc` clean, `npm test` 255 green, `next build` clean (both `/pay`
and `results/by-session` in the route manifest), `db:validate` clean,
diff-check clean, raw-query grep still only `lib/payment.ts:200`; preview
seed/by-session/manual `/pay` smoke pass. The `docs/02-architecture.md`
cleanup that was the sole remaining review-016 item is final-confirmed;
the branch is mergeable from Codex's review perspective.

### Prior branch (merged)

`feature/payment-webhook` — payment trust boundary (ADR-017), off
`main` @ `ffdab50`. Made the boundary production-correct as a
**simulated** signed webhook (no real Stripe): the browser checkout can
no longer mint `paid`; entitlement is granted by a signature-verified
provider webhook.

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

Verification: `tsc --noEmit` clean, `npm test` 251 green, `next build`
clean (/pay gone; payments/checkout + payments/webhook + /checkout
added), `npx prisma validate` clean, `git diff --check` clean. openssl
HMAC recipe verified to byte-match the server `signWebhookPayload`.
New env `PAYMENT_WEBHOOK_SECRET` in local `.env`; Owner sets it on
Vercel. Codex review-015 is Resolved at `a220c6b`; branch is mergeable
from the payment-webhook review perspective.

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
