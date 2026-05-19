# 07 — Delivery Checklist

> **Purpose.** The final pre-submission gate. Every box ticked = ready
> to email the deliverable. Mirrors the brief's deliverables list and
> `PROJECT_BRIEF.md` §6 (Definition of Done). Update as items land;
> stale unchecked boxes on submission day mean we miss them.
>
> **Owner.** Claude ticks engineering / docs / deploy. Owner signs off
> on the submission row.

## Product / docs

- [x] `02-architecture.md` v2 reflects accepted design (ADR-001…014)
- [x] `03-database-design.md` matches the shipped 5-table Prisma schema
      + ER Mermaid (incl. `step_event`)
- [x] `04-api-design.md` matches the seven shipped endpoints + ADR-014
      cookie TTL
- [x] `05-ai-collaboration-log.md` has substantive per-phase entries
- [x] `06-review-log.md` shows reviews-001/002/003/006/007 as `Resolved`
      and `review-004-final` open during final closeout

Out of scope for this delivery (skipped intentionally, not forgotten):
- `00-product-research.md` BetterMe observations write-up — not graded,
  not blocking the demo loop.
- `01-requirements.md` R-001…R-NNN list — `PROJECT_BRIEF.md` §3-§6
  serves the same role and is the artefact the evaluator reads.

## Engineering

- [x] `package.json` with `dev`, `build`, `start`, `db:deploy`,
      `test`, `typecheck` scripts (no `lint` script — `tsc --noEmit`
      is the type/correctness gate; no ESLint was wired in for the
      demo window)
- [x] `prisma/schema.prisma` + two migrations applied to Supabase
      (`20260518000000_init`, `20260519000000_add_step_event`)
- [x] All `/api/v1` endpoints behind a Zod schema
- [x] Two-serializer leak test asserts paid fields absent from teaser
      (`tests/lib/serializers/result.test.ts`)
- [x] `/submit` idempotency test passes
      (`tests/lib/result-repo.test.ts`)
- [x] `/pay` same-key replay test passes; already-paid different-key
      call silently no-ops without inserting a second `payment` row
      (`tests/lib/payment.test.ts`)
- [x] Cookie-TTL hardening: `iat` + 30d expiry + 60s clock-skew
      (`tests/lib/session.test.ts` "verifyCookie TTL")
- [x] Boundary tests for step inputs
      (`tests/lib/validation/steps.test.ts`,
      `tests/lib/validation/assessment.test.ts`,
      `tests/lib/health/calculator.test.ts`)
- [x] No `any` without justification; `tsc --noEmit` clean
- [x] 202 vitest tests green

### Security

- [x] Same-origin guard on every mutating route
      (`lib/api/same-origin.ts`, 7 cases in
      `tests/lib/api/same-origin.test.ts`)
- [x] `Idempotency-Key` restricted to 1-128 printable-ASCII chars
      (`lib/api/idempotency-key.ts`, 11 cases in
      `tests/lib/api/idempotency-key.test.ts`)
- [x] Security review at `docs/08-security-hardening.md` with attack
      surface, control evidence table, and out-of-scope rationale

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
- [ ] `review-009-security-hardening.md` `Resolved` (awaits Codex on
      `feature/security-hardening`)
- [x] `reviews/resolved-review-items.md` covers every adopted finding

## Submission (Owner)

- [ ] Public demo URL is live and warm
- [ ] GitHub repo is accessible to the email recipients
- [ ] DB schema diagram included in the email or repo root
- [ ] Email sent to `yitengruntu12123@gmail.com`,
      `alex@arkon-tech.com`, `rip@arkon-tech.com`
- [ ] Subject line follows `【姓名】_全栈挑战_YYYYMMDD`
