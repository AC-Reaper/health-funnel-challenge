# AGENTS

Highest-priority rule file for this repository. Both AI agents and humans
must read this before doing any work. `CLAUDE.md` is operational detail
that extends — never overrides — this file.

## 1. Project goal

Deliver, in 5 days, a publicly deployed health-funnel product (anonymous
funnel → server-side calculation → mock-paid result gate) that scores well
on the four criteria the brief grades: **API design, DB modelling, end-to-end
loop correctness, AI collaboration evidence**. See `PROJECT_BRIEF.md` for
the brief itself.

## 2. Roles

| Role | Agent | What they own | What they do not touch |
| - | - | - | - |
| Owner | Human | Final say on scope, decisions (D1–D…), open questions, what is "good enough" to ship. | Implementation details, file edits during normal flow. |
| Primary Implementer | Claude | All code, schema, migrations, docs `02`/`03`/`04`/`05`/`07`, `memory/claude-notes.md`, `task-board.md`, `decisions.md`, `open-questions.md`, `resolved-review-items.md`. | `memory/codex-notes.md`, `reviews/review-*.md` (Codex writes these). |
| Reviewer / QA / Architecture critic | Codex | `reviews/review-NNN-*.md`, `memory/codex-notes.md`, `docs/06-review-log.md`. May propose changes to any doc via a review. | Direct code edits (raise findings instead), `memory/claude-notes.md`. |

## 3. Collaboration rules

- One clear task per turn. Before editing, the implementer states the plan,
  affected files, and risks.
- Do **not** expand requirements beyond the current task. If a tradeoff or
  ambiguity appears, add it to `memory/open-questions.md` and wait for the
  owner.
- Never sacrifice type safety, input validation, error handling, or README
  reproducibility to ship faster.
- Decisions are made via `memory/decisions.md` (ADR style). A decision is
  not in force until logged there with status `Accepted` (or `Proposed` →
  signed off by Owner).
- Reviews trigger at the end of Day 1, Day 2, and Day 5 (minimum). Either
  agent can request an interim review when the surface area changes.
- No work begins on Day 1 implementation until ADR-001..013 are
  `Accepted` by the Owner.

## 3.1 Code management workflow

All feature work branches from `main`. Claude implements on the feature
branch, Codex reviews, Claude fixes any adopted findings, then the branch
is merged back to `main`.

Branch plan:

```text
main
├── feature/init-docs
├── feature/db-schema
├── feature/session-progress-api
├── feature/assessment-result-api
├── feature/pay-subscription
├── feature/frontend-funnel
└── feature/docs-delivery
```

Commit messages use Conventional Commits:

- `docs: initialize agent collaboration workflow`
- `feat: add prisma schema for quiz funnel`
- `feat: implement anonymous session api`
- `feat: add quiz progress persistence`
- `feat: implement assessment calculation`
- `feat: gate result api by subscription status`
- `feat: add simulated payment callback`
- `docs: add api examples and paid session instructions`

## 4. Code & engineering standards

- Language: **TypeScript strict** for all app + lib code; no `any` without
  a comment justifying it.
- Validation: **Zod** at every API boundary. Request types are inferred
  from Zod schemas — schemas are the source of truth.
- HTTP: REST under `/api/v1`. JSON in / JSON out. Use the unified error
  envelope from `docs/04-api-design.md`. Status codes follow HTTP
  semantics; never `200` with an error body.
- Auth: anonymous signed httpOnly cookie. The server never trusts a
  `session_id` from body / query / header. Every gated endpoint re-checks
  entitlement.
- Data: nullable columns for partial progress; UNIQUE constraints for
  idempotency; foreign keys with `ON DELETE` chosen deliberately.
- Calculator and serializers are **pure functions**. No I/O. Versioned
  (`algorithm_version`). Fixture-tested across boundary cases.
- Tests: at minimum, boundary validation, two-serializer leak test,
  idempotency tests (`/submit`, `/pay`).
- Migrations: `prisma/migrations` checked in. Never edit a shipped
  migration; add a new one.
- Comments: default to none. Only add when the WHY is non-obvious.
- No commented-out code, no `// TODO` without a ticket reference, no dead
  exports.

## 5. Review flow

1. Implementer finishes a task and updates the relevant docs + memory.
2. Implementer pings the Reviewer (Codex) by naming the next review file,
   e.g. `reviews/review-002-api.md`.
3. Reviewer writes the review with three sections: **Blocking**,
   **Important**, **Nice-to-have**. Each finding states **impact range**,
   **risk reason** (why this matters / what breaks if left unfixed), and
   **suggested fix**. All three fields are required for every finding,
   regardless of severity.
4. Implementer responds in the same conversation: for each finding,
   classifies as *adopt / partial / reject* with rationale.
5. Implementer applies adopted changes, then records the resolution in
   `reviews/resolved-review-items.md` with a pointer to the finding and the
   resolving file/commit.
6. Reviewer re-reviews until no Blocking items remain. Important items can
   be deferred only with an explicit owner-approved entry in
   `memory/open-questions.md`.

## 6. Memory maintenance rules

Memory files are the project's shared brain. Treat them as code.

| File | Purpose | Who writes | Update rule |
| - | - | - | - |
| `memory/shared-memory.md` | Currently-loaded context that both agents need at the start of any turn. Short. | Either | Update when anything changes that the other agent will need to know on its next turn. |
| `memory/decisions.md` | ADR-style log of every accepted technical decision. Immutable once `Accepted`. | Implementer (Owner approves) | Append-only. New decisions get a new ADR; superseding decisions get a new ADR that says "Supersedes ADR-NNN". Never edit an `Accepted` ADR's body — add a new one. |
| `memory/open-questions.md` | Unresolved decisions blocking work. | Either | Add Q with owner + status. Mark `Resolved` (with date + how) when answered, do not delete. |
| `memory/task-board.md` | Live work tracker, four columns: Todo / In Progress / Review / Done. | Implementer | Move tasks immediately on status change. Never leave In Progress empty if a turn is mid-flight. Done entries keep date + owner. |
| `memory/claude-notes.md` | Implementer's private notes, dated journal. | Claude only | Append-only. One bullet per turn at minimum. |
| `memory/codex-notes.md` | Reviewer's private notes, dated journal. | Codex only | Append-only. |
| `reviews/resolved-review-items.md` | Cross-walk from review findings to resolutions. | Implementer | Add one row per finding when (and only when) it is fixed in the design or code. |

Rules every agent obeys:

- **Read before acting** (every task): `AGENTS.md` → `PROJECT_BRIEF.md` → `memory/shared-memory.md` → `memory/decisions.md` → `memory/task-board.md` → latest open review.
- **Update after acting** (every task): `task-board.md` (status), `decisions.md` (if a decision was made), the relevant doc, the relevant `*-notes.md`, and `resolved-review-items.md` (if a review item was fixed).
- Convert relative dates to absolute (e.g. "Thursday" → `2026-05-22`) when writing.
- Do not delete entries; mark them superseded or resolved with a date.

## 7. Repository map

- `docs/` — Product / requirements / architecture / DB / API / AI-collab / review / delivery docs.
- `memory/` — Shared working memory (see §6).
- `reviews/` — Individual review reports + `resolved-review-items.md`.
- `prisma/` — Schema, migrations, seed.
- `app/` — Next.js App Router routes (UI + API route handlers).
- `lib/` — Shared application logic (session, validation, calculator, serializers).
- `tests/` — Automated tests.
- `scripts/` — One-off operational scripts (seed runner, demo printer).
