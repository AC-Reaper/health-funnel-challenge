# Task Board

Four columns: Todo → In Progress → Review → Done.
Tasks keep their `T-NNN` id (referenced from ADRs and reviews).
Owner is who does the work; reviews follow the AGENTS.md §5 flow.

## Todo

### Day 1 — Foundations (unblocked; ADR-001…013 Accepted)

- T-101 — Claude — Next.js 14 App Router skeleton (deps + `app/` scaffold; the Prisma half of `package.json` shipped on `feature/db-schema`)
- T-102 — Owner provisions Supabase project and shares `DATABASE_URL` + `DIRECT_URL`; Claude already wired `.env.example`, `package.json`, `prisma/`
- T-104 — Claude — `lib/session.ts`: signed-cookie create / read / verify
- T-105 — Claude — Endpoints `POST /api/v1/sessions`, `GET /api/v1/sessions/me`, `GET /api/v1/healthz`

### Day 2 — Funnel persistence

- T-201 — Claude — Zod step schemas in `lib/validation/steps.ts`
- T-202 — Claude — `PATCH /api/v1/sessions/me/steps/:stepKey` with first-incomplete-step rule (ADR-008)
- T-203 — Claude — Boundary tests (age 12/13/100/101; weight 0; target_weight vs goal coherence; out-of-order rejection)
- T-204 — Claude requests `reviews/review-002-api.md`; Codex writes it

### Day 3 — Submit / calculate / gate / pay

- T-301 — Claude — `lib/health/calculator.ts`, pure / deterministic / versioned / fixture-tested
- T-302 — Claude — `POST /api/v1/sessions/me/submit` (idempotent)
- T-303 — Claude — `GET /api/v1/results/me` with two-serializer gating + leak test
- T-304 — Claude — `POST /api/v1/pay` with single-transaction idempotency and already-paid no-op semantics (ADR-012)

### Day 4 — UI + deploy

- T-401 — Claude — Funnel UI: one step per screen, progress bar, server-driven resume, sticky CTA, paywall modal
- T-402 — Claude — `/pay` browser route, minimal mock payment form calling `POST /api/v1/pay`
- T-403 — Claude + Owner (env vars) — Deploy to Vercel + Supabase; verify cookie-jar cURL against prod
- T-404 — Claude — README: 60-second setup, env table, full cookie-jar cURL walkthrough, Postman collection link

### Day 5 — Hardening + final review

- T-501 — Claude — Edge cases: refresh mid-step, double-submit, double-pay same-key replay, already-paid new-key no-op, tampered cookie, expired cookie
- T-502 — Claude — Optional (only if slack): `step_event` audit table + writes
- T-503 — Claude — Schema diagram (Mermaid in `docs/03-database-design.md`)
- T-504 — Claude — `docs/05-ai-collaboration-log.md`: per-phase AI usage
- T-505 — Claude requests `reviews/review-004-final.md`; Codex writes it; Claude addresses every Blocking item

## In Progress

- None

## Review

- T-103 — Claude — `feature/db-schema` branch shipped: Prisma schema, initial migration, env scaffolding, `docs/03-database-design.md` filled. Awaiting Codex `reviews/review-003-db.md` (T-106).
- T-106 — Codex — Write `reviews/review-003-db.md` against the branch.

## Done

- 2026-05-18 — Codex — Initialize repository folder structure
- 2026-05-18 — Codex — `reviews/review-000-baseline-readiness.md` (5 Blocking, 4 Important, 2 Nice-to-have)
- 2026-05-18 — Claude — `CLAUDE.md` collaboration protocol created
- 2026-05-18 — Claude — Architecture v1 written to `docs/02-architecture.md`
- 2026-05-18 — Codex — `reviews/review-001-architecture.md` reviewed v1 (5 Blocking, 5 Important, 2 Nice-to-have)
- 2026-05-18 — Claude — Architecture v2 written; ADR-007…010 recorded; review-001 findings resolved in design
- 2026-05-18 — Claude — Full API contract written to `docs/04-api-design.md` v1
- 2026-05-18 — Claude — Repository scaffold upgrade pass: `AGENTS.md`, `PROJECT_BRIEF.md`, `README.md` rewritten; `decisions.md` → ADR style; `task-board.md` → 4-column format; skeleton headers added to `docs/00`, `01`, `03`, `05`, `06`, `07` and `memory/shared-memory.md`
- 2026-05-18 — Codex — Owner sign-off for ADR-001…010; Q-001 resolved; Day 1 unblocked
- 2026-05-18 — Codex — `reviews/review-005-governance-scaffold.md` (0 Blocking, 5 Important, 2 Nice-to-have)
- 2026-05-18 — Claude — review-005 fixes + memory-file format pass (I001–I005, N001–N002)
- 2026-05-18 — Codex — Owner decisions recorded: Q-002 English copy, Q-003 Mifflin-St Jeor formula, Q-006 silent no-op payment replay, ADR-011…013 accepted
- 2026-05-18 — Claude — `git init -b main` + baseline commit (`chore: initialise scaffold and design docs`); `feature/db-schema` branch created per ADR-011
- 2026-05-18 — Claude — `feature/db-schema`: shipped `package.json` + `tsconfig.json` + `.nvmrc` + `.gitignore` + `.env.example` + `.env` + `prisma/schema.prisma` + initial migration (`prisma/migrations/20260518000000_init/migration.sql`) + `migration_lock.toml`. `npm install`, `prisma format`, `prisma validate`, `prisma generate` all pass locally. `docs/03-database-design.md` filled (ER diagram + per-table columns + enum list + index rationale + migration runbook). `README.md` setup section refreshed.
