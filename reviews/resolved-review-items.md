# Resolved Review Items

Cross-walk from individual review findings to the change that resolved
them. Source-of-truth IDs match the review file that raised them
(`review-NNN-*.md`).

## B002 (partial): Architecture spec was missing

Source: `review-000-baseline-readiness.md`

Resolved in:
- `docs/02-architecture.md` (v2)
- `memory/decisions.md` (ADR-001…010, all Accepted 2026-05-18)

Verification:
Architecture v2 covers stack, route map, server/client responsibilities, persistence flow, calculator boundary, auth/session, payment gate, and failure modes. Owner accepted ADR-001…010.
Status: Resolved in design — implementation pending.

## B004 (partial): API contracts were missing

Source: `review-000-baseline-readiness.md`

Resolved in:
- `docs/04-api-design.md` (v1)

Verification:
Endpoint catalogue, auth model, error envelope, status-code table, and cookie-jar cURL walkthrough are all written. Implementation verification pending Day 1–3.
Status: Resolved in design — implementation pending.

## review-001 §3 Blocking: `/pay` route naming mismatch

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-006)
- `docs/02-architecture.md` §2
- `docs/04-api-design.md` §6, §7

Verification:
Browser route `GET /pay` + API route `POST /api/v1/pay` both present in the API doc. Recorded in ADR-006.
Status: Verified in design 2026-05-18.

## review-001 §3 Blocking: Paid seed session vs cookie auth

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-010)
- `docs/04-api-design.md` README cURL section

Verification:
Pre-seeded paid sessionId dropped. README ships cookie-jar cURL walkthrough that creates → submits → pays → reads in the evaluator's own session.
Status: Verified in design 2026-05-18.

## review-001 §3 Blocking: Step-progression rule

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-008)
- `docs/02-architecture.md` §2
- `docs/04-api-design.md` §3

Verification:
`current_step` recomputed server-side as first incomplete required step. PATCH that skips required earlier step returns `409 STEP_OUT_OF_ORDER` with `firstMissingStep`.
Status: Verified in design 2026-05-18.

## review-001 §2 Important: `step_event` over-design

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-009)
- `docs/02-architecture.md` §3 (marked optional)
- `memory/task-board.md` (T-502 optional, Day 5 only)

Verification:
`step_event` not in Day-1 migration. Day-5 optional task.
Status: Verified in design 2026-05-18.

## review-001 §2 Important: `subscription` + `payment_event` over-design

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-007)
- `docs/02-architecture.md` §3
- `docs/04-api-design.md` (no `subscription` endpoint)

Verification:
Single `payment` table + `session.entitlement_status` + `paid_at`. No `subscription` table.
Status: Verified in design 2026-05-18.

## review-001 §2 Nice-to-have: UUIDv7 + in-memory rate limit

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/decisions.md` (ADR-004 uses `crypto.randomUUID()`)
- `docs/02-architecture.md` §9 (rate limiting cut, README points to Upstash/Vercel KV as prod path)

Verification:
No UUIDv7 dependency. No in-memory rate limiter in MVP.
Status: Verified in design 2026-05-18.

## review-001 §4 Blocking: Unpaid users may receive paid fields

Source: `reviews/review-001-architecture.md`

Resolved in:
- `docs/02-architecture.md` §5
- `docs/04-api-design.md` §5

Verification:
Two-serializer design. Teaser return type cannot emit paid-only fields. Snapshot test will assert paid field names absent from teaser JSON.
Status: Verified in design 2026-05-18 — implementation test pending (T-303).

## review-001 §4 Blocking: Payment loop must close server-side

Source: `reviews/review-001-architecture.md`

Resolved in:
- `docs/04-api-design.md` §7
- `memory/decisions.md` (ADR-006)

Verification:
`POST /api/v1/pay` runs one transaction: insert `payment` with `ON CONFLICT (session_id, idempotency_key) DO NOTHING`, then UPDATE `session.entitlement_status = 'paid'`. `GET /api/v1/results/me` re-reads entitlement on every call.
Status: Verified in design 2026-05-18 — implementation test pending (T-304).

## review-001 §4 Important: README cookie-jar reproducibility

Source: `reviews/review-001-architecture.md`

Resolved in:
- `docs/04-api-design.md` (cookie-jar cURL block)

Verification:
Block is in API doc; will be copied verbatim into README at T-404 on Day 4.
Status: Verified in design 2026-05-18 — README finalization pending (T-404).

## review-001 §3 Important: Open-question tracking inconsistency

Source: `reviews/review-001-architecture.md`

Resolved in:
- `memory/open-questions.md`

Verification:
Q-001…Q-006 all present, status fields accurate.
Status: Resolved 2026-05-18.

## review-005 I001: Delivery checklist marked API design as matching shipped endpoints

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `docs/07-delivery-checklist.md`

Verification:
API design row is now unchecked with wording "draft exists; verify after T-105, T-202, T-302, T-303, T-304 ship".
Status: Resolved 2026-05-18.

## review-005 I002: Review flow omitted required "risk reason" field

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `AGENTS.md` §5 step 3

Verification:
Step 3 now requires impact range + risk reason + suggested fix on every finding.
Status: Resolved 2026-05-18.

## review-005 I003: PROJECT_BRIEF said 4 deliverables but listed 5

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `PROJECT_BRIEF.md` §3

Verification:
Section §3 now lists 4 deliverables. The cookie-jar paid demo path is folded into deliverable #1 as proof evidence.
Status: Resolved 2026-05-18.

## review-005 I004: Q-006 payment replay semantics still open

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `memory/open-questions.md` (Q-006 resolved with Owner choice B)
- `memory/decisions.md` (ADR-012 records silent no-op replay semantics)
- `docs/02-architecture.md`
- `docs/04-api-design.md`
- `docs/07-delivery-checklist.md`

Verification:
Already-paid sessions with a new `Idempotency-Key` now silently no-op,
return existing paid entitlement, and do not insert a second `payment` row.
Status: Resolved in design 2026-05-18.

## review-005 I005: docs/02 still used D1–D6 sign-off language

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `docs/02-architecture.md` §0 (now an "Accepted decisions" index referencing ADR-001…013)
- Header status line updated to v2 + decision gate cleared

Verification:
No mention of "awaiting sign-off on D1–D6" remains.
Status: Resolved 2026-05-18.

## review-005 N001: T-106 ownership ambiguity

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `memory/task-board.md` (T-106, T-204, T-505)

Verification:
Wording is now "Claude requests `reviews/review-NNN-*.md`; Codex writes it" — splitting trigger ownership from review authorship.
Status: Resolved 2026-05-18.

## review-003 B001: result.bmi decimal(4,2) overflow on API-admitted boundary

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma` (`Result.bmi` → `Decimal(5,2)`)
- `prisma/migrations/20260518000000_init/migration.sql`
- `docs/03-database-design.md` §3 (Result table)

Verification:
`heightCm=120, weightKg=250` yields BMI ≈ 173.61, which now fits in `decimal(5,2)`. A submit fixture for the boundary will be added in T-301 (Day 3).
Status: Resolved 2026-05-18.

## review-003 I001: payment table missing "one successful payment per session" backstop

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/migrations/20260518000000_init/migration.sql` (appended SQL-only partial unique index `payment_one_success_per_session_idx ON payment(session_id) WHERE status='succeeded'`)
- `prisma/schema.prisma` (documented in the `Payment` model docstring)
- `docs/03-database-design.md` §3 + §5

Verification:
Even if a future `/pay` handler regressed past the application-level `ON CONFLICT` logic, a second `succeeded` row for the same session would fail to insert. `failed` rows remain unconstrained for audit flexibility.
Status: Resolved 2026-05-18.

## review-003 I002: timestamp freshness relied on manual updates

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma` (`Session.updatedAt` and `Assessment.updatedAt` use `@updatedAt`)
- `prisma/migrations/20260518000000_init/migration.sql` (NOT NULL columns; Prisma sets the value on every write)
- `docs/03-database-design.md` §3

Verification:
Every Prisma write — including step edits that leave `current_step` unchanged — now refreshes the timestamp. Raw SQL inserts outside Prisma would need to supply the value explicitly; this is acceptable because every write path in this project goes through Prisma.
Status: Resolved 2026-05-18.

## review-003 I003: payment text fields wider than the API contract

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma` (`Payment.idempotencyKey` → `VarChar(128)`, `Payment.currency` → `Char(3)`)
- `prisma/migrations/20260518000000_init/migration.sql`
- `docs/03-database-design.md` §3 (Payment table)

Verification:
The DB now refuses an idempotency key longer than 128 chars or a currency value that is not exactly 3 chars, regardless of validation regressions.
Status: Resolved 2026-05-18.

## review-003 I004: API example used a prefixed payment id while schema stores UUIDs

Source: `reviews/review-003-db.md`

Resolved in:
- `docs/04-api-design.md` §7 (`paymentId` example now shows a UUID)

Verification:
The doc example matches `payment.id`'s UUID type. No `public_id` column was introduced.
Status: Resolved 2026-05-18.

## review-003 N001: README status was stale for the db-schema branch

Source: `reviews/review-003-db.md`

Resolved in:
- `README.md` (Status section)

Verification:
Status now reads "DB schema and initial migration shipped on `feature/db-schema`; no API or frontend application code yet."
Status: Resolved 2026-05-18.

## review-003 N002: payment FK rationale wording was imprecise

Source: `reviews/review-003-db.md`

Resolved in:
- `docs/03-database-design.md` §3 (Payment table) — reworded to "prevent accidental session deletes from erasing audit data" instead of "must outlive any accidental session delete".

Verification:
Wording now matches `ON DELETE RESTRICT` semantics: the delete is blocked, not bypassed.
Status: Resolved 2026-05-18.

## review-003 N003: migration runbook overstated bit-for-bit parity

Source: `reviews/review-003-db.md`

Resolved in:
- `docs/03-database-design.md` §6 — now reads "matches Prisma's diff output, with two intentional additions: `pgcrypto` prepended, and the partial unique index appended".

Verification:
The committed migration's two extra blocks are explicitly documented.
Status: Resolved 2026-05-18.

## review-003 re-review: Blocking and Important fixes verified

Source: `reviews/review-003-db.md`

Resolved in:
- `prisma/schema.prisma`
- `prisma/migrations/20260518000000_init/migration.sql`
- `docs/03-database-design.md`
- `docs/04-api-design.md`
- `README.md`

Verification:
Codex re-reviewed `feature/db-schema` at `cc40d3d` on 2026-05-18. `npm run db:validate`, `npm run db:generate`, `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, and `git diff --check` all pass for the locally verifiable surface. Original review-003 B001 and I001-I004 are resolved. One new docs-only Nice-to-have remains: the ER diagram type labels should be refreshed to match the final schema.
Status: Re-verified by Codex 2026-05-18.

## review-003 (re-review) N004: ER diagram type labels stale after schema fixes

Source: `reviews/review-003-db.md` re-review

Resolved in:
- `docs/03-database-design.md` §2 Mermaid block

Verification:
`RESULT.bmi` is now labelled `decimal_5_2`; `PAYMENT.idempotency_key` is `varchar_128`; `PAYMENT.currency` is `char_3`. Diagram matches the table reference, Prisma schema, and migration SQL.
Status: Resolved 2026-05-18.

## review-005 N002: Day-1 docs risk becoming long-form essays

Source: `reviews/review-005-governance-scaffold.md`

Resolved in:
- `docs/00-product-research.md` (Day-1 guidance block at top)
- `docs/01-requirements.md` (Day-1 guidance block at top)

Verification:
Each doc now opens with a "keep this short" instruction explaining what belongs there vs not.
Status: Resolved 2026-05-18.
