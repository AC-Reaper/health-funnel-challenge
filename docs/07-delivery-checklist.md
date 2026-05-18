# 07 — Delivery Checklist

> **Purpose.** The final pre-submission gate. Every box ticked = ready
> to email the deliverable. Mirrors the brief's deliverables list and
> `PROJECT_BRIEF.md` §6 (Definition of Done). Update as items land;
> stale unchecked boxes on submission day mean we miss them.
>
> **Owner.** Claude ticks engineering / docs / deploy. Owner signs off
> on the submission row.

## Product / docs

- [ ] `00-product-research.md` filled with observations from the
      BetterMe reference (Day 1)
- [ ] `01-requirements.md` lists R-001…R-NNN with acceptance tests
- [x] `02-architecture.md` v2 reflects accepted design
- [ ] `03-database-design.md` matches the shipped Prisma schema + ER
      diagram
- [ ] `04-api-design.md` matches the shipped endpoints (draft exists;
      verify after T-105, T-202, T-302, T-303, T-304 ship)
- [ ] `05-ai-collaboration-log.md` has a substantive entry per phase
- [ ] `06-review-log.md` shows all reviews as `Resolved` or
      `Closed-informed`

## Engineering

- [ ] `package.json` with `dev`, `build`, `start`, `db:deploy`,
      `test`, `lint` scripts
- [ ] `prisma/schema.prisma` + initial migration applied to Supabase
- [ ] All `/api/v1` endpoints behind a Zod schema
- [ ] Two-serializer leak test asserts paid fields absent from teaser
- [ ] `/submit` idempotency test passes
- [ ] `/pay` same-key replay test passes; already-paid different-key call
      silently no-ops without inserting a second `payment` row
- [ ] Boundary tests for step inputs
- [ ] No `any` without justification; `tsc --noEmit` clean
- [ ] `npm run lint` clean

## Deploy / demo

- [ ] Vercel project linked, env vars set (`DATABASE_URL`,
      `DIRECT_URL`, `SESSION_COOKIE_SECRET`)
- [ ] Supabase project provisioned, migration applied via `DIRECT_URL`
- [ ] Public URL responds to `/api/v1/healthz`
- [ ] README cookie-jar cURL block runs end-to-end on a fresh shell
- [ ] Postman collection mirrors the cURL flow

## Review

- [ ] `review-001-architecture.md` re-reviewed as `Resolved`
- [ ] `review-002-api.md` `Resolved`
- [ ] `review-003-db.md` `Resolved`
- [ ] `review-004-final.md` `Resolved` (no Blocking findings)
- [ ] `reviews/resolved-review-items.md` covers every adopted finding

## Submission (Owner)

- [ ] Public demo URL is live and warm
- [ ] GitHub repo is accessible to the email recipients
- [ ] DB schema diagram included in the email or repo root
- [ ] Email sent to `yitengruntu12123@gmail.com`,
      `alex@arkon-tech.com`, `rip@arkon-tech.com`
- [ ] Subject line follows `【姓名】_全栈挑战_YYYYMMDD`
