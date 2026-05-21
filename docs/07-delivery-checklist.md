# 07 — Delivery Checklist

> **Purpose.** The final pre-submission gate. Every box ticked = ready
> to email the deliverable. Mirrors the brief's deliverables list and
> `PROJECT_BRIEF.md` §6 (Definition of Done). Update as items land;
> stale unchecked boxes on submission day mean we miss them.
>
> **Owner.** Claude ticks engineering / docs / deploy. Owner signs off
> on the submission row.

## Product / docs

- [x] `02-architecture.md` v2 reflects accepted design (ADR-001…019)
- [x] `03-database-design.md` matches the shipped schema — 5 domain
      tables + the operational `rate_limit` table (ADR-016) + ER
      Mermaid (incl. `step_event`); three migrations listed
- [x] `04-api-design.md` matches the ten shipped endpoints (incl. mock
      `POST /api/v1/pay` ADR-018, `payments/checkout` + signed
      `payments/webhook` ADR-017, and demo `results/by-session` ADR-019) +
      ADR-014 cookie TTL + `429 RATE_LIMITED` (ADR-016)
- [x] `05-ai-collaboration-log.md` has substantive per-phase entries
- [x] `06-review-log.md` is current through the latest review
      (reviews 000…013 all `Resolved` or
      `Resolved-in-design`/`Closed-informed`)
- [x] `00-product-research.md` filled with the BetterMe Pilates funnel
      walkthrough (steps, persisted data, pre/post-paywall surface,
      and our deliberate divergences)
- [x] `01-requirements.md` filled with R-001…R-018 functional +
      R-101…R-112 non-functional requirements mapped to sources and
      acceptance tests (`PROJECT_BRIEF.md` §3-§6 remains the canonical
      DoD; this restates it against stable R-NNN ids)

## Engineering

- [x] `package.json` with `dev`, `build`, `start`, `db:deploy`,
      `test`, `typecheck` scripts (no `lint` script — `tsc --noEmit`
      is the type/correctness gate; no ESLint was wired in for the
      demo window)
- [x] `prisma/schema.prisma` + three migrations applied to Supabase
      (`20260518000000_init`, `20260519000000_add_step_event`,
      `20260521000000_add_rate_limit`)
- [x] All `/api/v1` endpoints behind a Zod schema
- [x] Two-serializer leak test asserts paid fields absent from teaser
      (`tests/lib/serializers/result.test.ts`)
- [x] `/submit` idempotency test passes
      (`tests/lib/result-repo.test.ts`)
- [x] Payment-grant same-key replay test passes; already-paid
      different-key call silently no-ops without inserting a second
      `payment` row (`tests/lib/payment.test.ts`; the shared
      `processPayment` grant primitive backs both the mock `/pay`
      (ADR-018) and the signed webhook (ADR-017))
- [x] Cookie-TTL hardening: `iat` + 30d expiry + 60s clock-skew
      (`tests/lib/session.test.ts` "verifyCookie TTL")
- [x] Boundary tests for step inputs
      (`tests/lib/validation/steps.test.ts`,
      `tests/lib/validation/assessment.test.ts`,
      `tests/lib/health/calculator.test.ts`)
- [x] No `any` without justification; `tsc --noEmit` clean
- [x] 251 vitest tests green

### Security

- [x] Same-origin guard on every mutating route — host + conditional
      scheme via `x-forwarded-proto` (`lib/api/same-origin.ts`, 11
      cases in `tests/lib/api/same-origin.test.ts`)
- [x] `Idempotency-Key` restricted to 1-128 printable-ASCII chars
      (`lib/api/idempotency-key.ts`, 11 cases in
      `tests/lib/api/idempotency-key.test.ts`)
- [x] Payment cannot precede `/submit`: `POST /api/v1/payments/checkout`
      returns `409 NOT_SUBMITTED` for a draft session, and the
      signature-verified `POST /api/v1/payments/webhook` returns
      `409 NOT_SUBMITTED` / `404 NOT_FOUND` for a not-submitted / unknown
      session before reaching the grant (ADR-017); `processPayment`
      remains the authoritative re-check
- [x] Security review at `docs/08-security-hardening.md` with attack
      surface, control evidence table, and out-of-scope rationale
- [x] Logical model mapping (User / Subscription / Payment) in
      `docs/03-database-design.md` §2.1
- [x] Rate limiting on hot write routes — Postgres-backed best-effort
      fixed-window (`lib/api/rate-limit.ts`, ADR-016); `/sessions`,
      step PATCH, `/submit`, `pay`, `payments/checkout`, `payments/webhook`;
      `429 RATE_LIMITED` + `Retry-After`;
      12 cases in `tests/lib/api/rate-limit.test.ts`
- [x] Payment trust boundary — the *production* boundary grants only via
      the signature-verified `POST /api/v1/payments/webhook` (HMAC over raw
      body + amount/currency/status check, ADR-017); browser
      `payments/checkout` cannot mint `paid`. Pure sign/verify/validate in
      `lib/payment-webhook.ts`; `tests/lib/payment-webhook.test.ts`. Env
      `PAYMENT_WEBHOOK_SECRET` (set on Vercel).
- [x] Brief deliverable §三/§五-1b — directly-callable mock
      `POST /api/v1/pay` (secret-free, same-origin + cookie +
      `Idempotency-Key`, ADR-018) flips entitlement via the shared
      `processPayment`; replayable README cURL needs no secret.
- [x] Brief deliverable §五-1c — paid test sessionId: `npm run seed:demo`
      mints a paid + free session and prints both ids; read-only
      `GET /api/v1/results/by-session?sessionId=<id>` returns the same
      leak-tested full/teaser serializers for a direct pre/post diff.

## Deploy / demo

- [x] Vercel project linked, env vars set (`DATABASE_URL`,
      `DIRECT_URL`, `SESSION_COOKIE_SECRET`)
- [x] Supabase project provisioned, migrations applied via `DIRECT_URL`
- [x] Public URL responds to `/api/v1/healthz`
      (`https://project-u415a.vercel.app/api/v1/healthz`)
- [x] README cookie-jar cURL block runs end-to-end on a fresh shell
      against the deployed URL
- [x] Codex `review-007-browser-smoke.md` verifies the full browser
      flow on the production URL

Out of scope: a separate Postman collection. The cURL cookie-jar
walkthrough in the README is the canonical reproducer; Postman would
duplicate it.

## Review

- [x] `review-001-architecture.md` `Resolved`
- [x] `review-002-api.md` `Resolved`
- [x] `review-003-db.md` `Resolved`
- [x] `review-006-day3.md` `Resolved`
- [x] `review-007-browser-smoke.md` `Resolved`
- [x] `review-004-final.md` `Resolved` (no Blocking, Important, or
      Nice-to-have findings remain; verified at `f2b37f8`)
- [x] `review-008-frontend-polish.md` `Resolved` (verified at `c974fbb`)
- [x] `review-009-security-hardening.md` `Resolved` (verified at `bcb4f2a`)
- [x] `review-010-delivery-compliance.md` `Resolved` (post-fix at the
      branch head; I001 + N001 closed before merge)
- [x] `reviews/resolved-review-items.md` covers every adopted finding

## Submission (Owner)

- [ ] Public demo URL is live and warm (https://project-u415a.vercel.app/)
- [ ] GitHub repo is accessible to the email recipients (`AC-Reaper/health-funnel-challenge`, public)
- [ ] DB schema diagram included in the email or repo root (Mermaid in `docs/03-database-design.md` §2)
- [ ] Email sent to `yitengruntu12123@gmail.com`,
      `alex@arkon-tech.com`, `rip@arkon-tech.com` — copy-paste body
      from the **Submission email template** at the bottom of
      `README.md`
- [ ] Subject line follows `【姓名】_全栈挑战_20260520`
