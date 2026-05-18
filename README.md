# Health Funnel Challenge

A 5-day full-stack interview project: a BetterMe-style health quiz funnel
with anonymous sessions, server-side health calculation, and a mock-paid
result gate. Optimised for the four things the brief grades — API design,
DB modelling, end-to-end loop correctness, and AI collaboration — not for
UI fidelity.

## Project goal

Deliver a public, end-to-end demo where a visitor can complete a 6-step
health funnel, see a teaser result, hit a mock `/pay`, and see the
full personalised plan. The backend must enforce the paywall server-side,
persist partial progress across refreshes, and replay-safely handle
double-clicks on submit and pay.

See `PROJECT_BRIEF.md` for the scoring criteria and MVP boundary, and
`docs/02-architecture.md` for the full technical design.

## Tech stack

| Layer | Choice | Why (short version) |
| - | - | - |
| Frontend | Next.js 14 (App Router) + TypeScript | Same process serves UI + API; fastest path to a public demo URL. |
| Backend | Next.js route handlers + TypeScript | One repo, one deploy. |
| Validation | Zod at every API boundary | Single source of truth for runtime checks and TS types. |
| Database | PostgreSQL (Supabase Free) | Brief lists this combo; managed, free, no ops. |
| ORM / migrations | Prisma | First-class TS types; checked-in migrations. |
| Identity | Anonymous session, signed httpOnly cookie | Brief permits session/UUID; no real-auth scope creep. |
| Payment | Fully mocked `POST /api/v1/pay` with `Idempotency-Key` | Brief asks for mock; replay-safe by DB unique constraint. |
| Hosting | Vercel (app) + Supabase (DB) | Free tier; public HTTPS URL out of the box; no VPS required. |

Full decision history lives in `memory/decisions.md` (ADR-001…013).

## Status

DB schema and initial migration shipped on `feature/db-schema`; no API
or frontend application code yet. ADR-001…013 are accepted and
`memory/open-questions.md` has no open blocker. Live `prisma migrate
deploy` is waiting on Supabase provisioning (T-102).

## To be added (in implementation order)

| Day | What lands here |
| - | - |
| Day 1 | ✅ `package.json` + Prisma schema + first migration (shipped on `feature/db-schema`). Remaining: Next.js skeleton, signed-cookie session lib, `POST /api/v1/sessions`, `GET /api/v1/sessions/me`, `/api/v1/healthz`. |
| Day 2 | Zod step schemas, `PATCH /api/v1/sessions/me/steps/:stepKey` with first-incomplete-step rule, boundary tests. |
| Day 3 | `lib/health/calculator.ts`, `POST /api/v1/sessions/me/submit`, two-serializer `GET /api/v1/results/me`, `POST /api/v1/pay`. |
| Day 4 | Funnel UI, `/pay` browser page, Vercel + Supabase deploy, full README (env vars, cookie-jar cURL block, Postman collection). |
| Day 5 | Edge-case hardening, optional `step_event`, schema diagram, AI collaboration log, Codex final review. |

## Code management

Feature work branches from `main`; Claude implements, Codex reviews,
Claude fixes adopted findings, then the branch merges back to `main`.

Planned branches:

- `feature/init-docs`
- `feature/db-schema`
- `feature/session-progress-api`
- `feature/assessment-result-api`
- `feature/pay-subscription`
- `feature/frontend-funnel`
- `feature/docs-delivery`

Commit messages use Conventional Commits, for example
`feat: implement anonymous session api` or
`docs: add api examples and paid session instructions`.

## Setup (current — final demo block lands Day 4)

```bash
# 1. Clone
git clone <repo-url> && cd health-funnel-challenge

# 2. Install
npm install

# 3. Env vars
cp .env.example .env
# fill DATABASE_URL (Supabase pooled, port 6543) and
# DIRECT_URL (Supabase direct, port 5432).
# SESSION_COOKIE_SECRET is not yet read by any code on `main`; set
# anything (will be enforced from feature/session-progress-api).

# 4. Generate Prisma client (no DB required)
npm run db:generate

# 5. Apply migrations (requires DIRECT_URL pointing at Postgres)
npm run db:deploy
```

`npm run dev` is not wired yet — Next.js scaffold lands on
`feature/session-progress-api`. Node 20 LTS is pinned via `.nvmrc`.

## Demo path (placeholder — final cURL cookie-jar block lands Day 4)

The full reproducible flow (create session → save 6 steps → submit →
teaser → `/pay` → full) is drafted in `docs/04-api-design.md` and will be
copied into this README on Day 4 once the deployed URL exists.

## Documentation

- `PROJECT_BRIEF.md` — scoring criteria, MVP boundary.
- `AGENTS.md` — roles, collaboration rules, memory maintenance.
- `docs/02-architecture.md` — full technical design (v2).
- `docs/04-api-design.md` — endpoint contracts, error model.
- `docs/03-database-design.md` — Prisma schema (Day 1).
- `docs/05-ai-collaboration-log.md` — how Claude/Codex were used per phase.
- `memory/decisions.md` — ADR log.
- `memory/task-board.md` — live task tracker.
