# Review 000: Baseline Readiness

## Status

Closed-informed

The baseline findings informed Claude's architecture v1/v2, API contract,
ADR log, and scaffold rewrite. Remaining implementation-dependent risks
are tracked in later reviews.

## Review Date

2026-05-18

## Scope

Baseline review of the current repository state before main implementation. Reviewed `AGENTS.md`, project memory, docs, review placeholders, README, and empty implementation directories.

## Summary

The repository currently establishes collaboration folders and review placeholders, but the challenge deliverable is not yet reviewable as a full-stack product. Most product, architecture, database, API, delivery, and AI-collaboration content remains `TBD`, and `app/`, `lib/`, `prisma/`, `tests/`, and `scripts/` contain no implementation files.

From an interviewer perspective, the current state would be scored as an incomplete scaffold. The highest-risk gaps are the absence of a testable product specification, missing API/database contracts, no payment/member-result access model, no persistence/resume design, and no reproducible run instructions.

## Blocking

### B001: Product scope and acceptance criteria are still undefined

- Impact range: `PROJECT_BRIEF.md`, `docs/01-requirements.md`, `docs/00-product-research.md`, final product scoring.
- Risk reason: The challenge cannot be evaluated without a clear funnel flow, target user, expected outputs, membership boundary, payment promise, and acceptance criteria. This also prevents QA from distinguishing intentional MVP tradeoffs from missing behavior.
- Suggested fix: Define the end-to-end user journey, required pages, input steps, generated health result shape, free vs paid result boundary, `/pay` flow, and concrete acceptance criteria for save/resume, calculations, and restricted result access.

### B002: Architecture is not specified enough to guide implementation

- Impact range: `docs/02-architecture.md`, `app/`, `lib/`, API routes, state management, auth/payment boundaries.
- Risk reason: Without component boundaries and data-flow decisions, implementation can drift into a CRUD demo or fragile client-only funnel. This directly affects interview scoring for architecture, trust boundaries, and state consistency.
- Suggested fix: Document the chosen stack, route map, server/client responsibilities, persistence flow, calculation service boundary, auth/session approach, membership/payment gate, and failure-mode handling before feature coding accelerates.

### B003: Database model is absent

- Impact range: `docs/03-database-design.md`, `prisma/`, migration strategy, resume/recompute behavior.
- Risk reason: The project explicitly depends on multi-step save and recovery. Without schema decisions for users/sessions, funnel responses, calculation snapshots, result visibility, payment records, and audit timestamps, later implementation may store state in unscalable blobs or lose consistency across partial saves.
- Suggested fix: Create a Prisma schema and database design doc covering entities, relationships, enum/status fields, indexes, uniqueness constraints, nullable fields for partial progress, and migration notes.

### B004: API contracts and error model are missing

- Impact range: `docs/04-api-design.md`, frontend integration, tests, security review.
- Risk reason: Missing endpoint contracts make it hard to verify professional API design, idempotency, server-side validation, authorization checks, payment webhook/callback handling, and non-member data restrictions.
- Suggested fix: Define endpoint contracts with method, path, auth requirement, request/response schema, validation errors, permission failures, idempotency behavior, and status codes. Include explicit contracts for saving steps, resuming progress, calculating results, getting gated results, and payment completion.

### B005: No implementation or reproducible delivery path exists yet

- Impact range: `app/`, `lib/`, `tests/`, `scripts/`, `README.md`, `docs/07-delivery-checklist.md`.
- Risk reason: The README only describes folder structure. An evaluator cannot run, test, or verify the product, and empty tests/scripts leave delivery quality unproven.
- Suggested fix: Add runnable application code, environment setup, database setup/migration commands, seed or sample data if useful, test commands, known limitations, and a concise demo path in README.

## Important

### I001: Payment and membership gating are not modeled as a closed loop

- Impact range: `/pay`, result access, API authorization, database state.
- Risk reason: One of the scoring risks is whether non-members can obtain the full result. If payment status, membership entitlement, and result visibility are not modeled server-side, a client-side gate can be bypassed.
- Suggested fix: Treat payment completion as a server-trusted state transition. Store payment or entitlement status, gate full-result APIs on the server, and return only teaser/summary data for unpaid users.

### I002: Server-side calculation trust boundary is not documented

- Impact range: health score/result calculation, validation, tests.
- Risk reason: If health scoring is computed client-side or accepts client-provided result fields, users can tamper with outputs. Boundary values and incomplete answers can also produce misleading or broken results.
- Suggested fix: Implement calculation in a server-side module with typed inputs, validation, deterministic scoring rules, boundary tests, and explicit handling for missing, out-of-range, or inconsistent answers.

### I003: AI collaboration evidence is currently only a placeholder

- Impact range: `docs/05-ai-collaboration-log.md`, `memory/claude-notes.md`, `memory/codex-notes.md`, interview differentiation.
- Risk reason: The brief asks the project to show AI collaboration ability. Empty logs make the process look like a generic scaffold rather than coordinated human/AI delivery.
- Suggested fix: Record meaningful agent contributions, decisions, review responses, and resolved review items as work happens. Link review files and decision entries from the collaboration log.

### I004: Task board and open questions are too generic to coordinate delivery

- Impact range: `memory/task-board.md`, `memory/open-questions.md`, cross-agent workflow.
- Risk reason: Current placeholders do not expose priority, ownership, or blockers. This increases the chance that Claude implements features before product/API/database decisions are settled.
- Suggested fix: Convert placeholders into concrete tasks with owners/status, and replace `TBD` open questions with real unresolved decisions such as auth depth, payment simulation vs provider, scoring methodology, and persistence granularity.

## Nice-to-have

### N001: Review placeholders should become stage-specific checklists

- Impact range: `reviews/review-001-architecture.md`, `reviews/review-002-api.md`, `reviews/review-003-db.md`, `reviews/review-004-final.md`.
- Risk reason: Generic `TBD` placeholders do not guide future reviewers or implementers toward the expected quality bar.
- Suggested fix: Add criteria sections to each review file, such as trust boundaries, consistency, access control, edge cases, tests, and delivery evidence.

### N002: Repository is not currently inside a detectable Git worktree

- Impact range: collaboration traceability, change review, rollback, final submission hygiene.
- Risk reason: Without version control metadata, reviewers cannot inspect diffs, isolate agent changes, or tie fixes to review items. This is not product-blocking, but it weakens collaboration evidence.
- Suggested fix: Initialize or move the project into a Git worktree before implementation ramps up, then keep commits focused by feature or review fix.

## Follow-up Review Triggers

- Re-run architecture review after `docs/02-architecture.md` includes route map, data flow, and trust boundaries.
- Re-run API review after endpoint contracts and server validation behavior are documented or implemented.
- Re-run database review after Prisma schema and migration notes exist.
- Re-run final review after README, tests, `/pay`, gated result access, and save/resume flow are implemented.
