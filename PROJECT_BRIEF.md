# Project Brief

> Source of truth for what we are building, why, and how the outcome will
> be judged. If anything below conflicts with downstream docs, this file
> wins until amended (and the amendment is recorded as an ADR in
> `memory/decisions.md`).

## 1. Project

**Health Funnel Challenge** — 睿迄科技 全栈 5 天挑战。

## 2. The brief, in our words

Build the backend (and minimum frontend) of a BetterMe-style health quiz
funnel. The judges will run the deployed app, do the funnel end-to-end,
hit the mock `/pay` endpoint, and confirm the gated result behaves
correctly before vs after payment. They are explicitly **not** grading UI
fidelity; they **are** grading the engineering spine.

Full brief lives outside the repo at `../test.md`. Key constraints copied
here so this file stands alone:

- Frontend: Next.js App Router or equivalent.
- Backend: Node.js + TypeScript (Next.js route handlers acceptable).
- Database: Supabase / Prisma + PostgreSQL.
- Deployment: **must be publicly reachable** and demoable end-to-end.
- Window: 5 days.

## 3. What we must deliver

Four deliverables, matching the brief's "4 大交付物".

1. **Public demo URL** — anonymous user can walk the funnel and trigger
   `/pay` from start to finish. The README's cookie-jar cURL walkthrough
   doubles as the "show paid vs unpaid" proof; we do **not** ship a raw
   paid `sessionId` because cookie-only auth makes it unusable (ADR-010).
2. **GitHub repo + README** — 60-second setup, env table, exact cURL
   walkthrough for the demo path, API doc pointer.
3. **DB schema diagram** — entity relationships across session,
   assessment, result, and payment.
4. **AI collaboration retrospective** — how Claude/Codex were used per
   phase (schema design, validation, calculator, review).

## 4. Scoring criteria (what the judges actually grade)

| Criterion | What it really means | Where we prove it |
| - | - | - |
| **API design** | Route shape, request/response, validation rigour, error model, status codes. | `docs/04-api-design.md`, Zod schemas, integration tests. |
| **DB modelling** | Extensible schema, sensible field types, plausible relations, indexes, partial-progress story. | `docs/03-database-design.md`, Prisma schema, migrations. |
| **Closed loop** | Entry → store → gate → mock pay → full result, including refresh, double-submit, double-pay, and invalid input paths. | Live demo + cURL walkthrough + edge-case tests. |
| **AI collaboration** | Did you actually collaborate with the model or just generate code? | `docs/05-ai-collaboration-log.md`, `reviews/`, `memory/decisions.md`, `memory/claude-notes.md`, `memory/codex-notes.md`. |

## 5. MVP scope (in / out)

**In** (the minimum that closes the loop the judges grade):

- Anonymous session via signed httpOnly cookie.
- 6-step funnel: `gender → main_goal → age → height → weight+target_weight → activity_level`. Each step zod-validated and persisted.
- Server-side computation on `/submit`: BMI + category, daily calorie target, predicted target-weight date, weekly curve points. Versioned algorithm.
- Server-gated result endpoint with **two distinct serializers** (teaser vs full). Teaser is incapable of emitting paid-only fields.
- Mock payment: browser `/pay` page + `POST /api/v1/pay` with `Idempotency-Key` header, single transaction.
- Public Vercel + Supabase deployment, free tier, no servers to operate.
- README with full cURL cookie-jar walkthrough.

**Out** (deliberately, with rationale in `docs/02-architecture.md` §9):

Real auth, real payment provider, recurring `subscription` table, multi-device
resume, i18n, A/B testing, ML scoring, email/notifications, admin dashboard,
Sentry/APM, production-grade rate limiting, GraphQL/tRPC, `step_event` audit
table (unless Day 5 has slack), pre-seeded paid `sessionId`, UUIDv7.

## 6. Definition of done (per scoring criterion)

- ✅ Every `/api/v1/*` endpoint has a Zod request schema and a typed
  response schema; an integration test exercises happy path + at least
  one failure path.
- ✅ `GET /api/v1/results/me` returns *teaser* for `entitlement_status =
  free` and *full* for `paid`; a leak test asserts no paid field name
  appears in the teaser JSON.
- ✅ `POST /api/v1/pay` is replay-safe under the same `Idempotency-Key`
  and writes both the `payment` row and the entitlement flip in one
  transaction.
- ✅ Once a session is already paid, another `/pay` call with a new
  `Idempotency-Key` silently no-ops, returns the existing entitlement,
  and does not insert a second `payment` row.
- ✅ Refresh mid-step resumes at the correct first-incomplete step.
- ✅ Vercel URL responds to the README cURL block end-to-end on a fresh
  shell.
- ✅ `docs/05-ai-collaboration-log.md` has at least one substantive
  retrospective per day, not a generic summary.

## 7. Constraints & non-goals

- Time budget: 5 days, with Day 5 reserved for hardening + AI log + final
  review.
- Cost budget: $0 (Vercel Hobby + Supabase Free).
- Single device per session. Multi-device resume is a documented
  limitation, not a defect.
- No production-grade rate limiting; demo only.

## 8. Pointers

- Architecture: `docs/02-architecture.md`
- API contracts: `docs/04-api-design.md`
- DB schema: `docs/03-database-design.md` (TBD — Day 1)
- Decisions: `memory/decisions.md`
- Open questions: `memory/open-questions.md`
- Task board: `memory/task-board.md`
