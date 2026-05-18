# Review 003: Database

## Status

Resolved — 2026-05-18 re-review

Branch reviewed: `feature/db-schema`

Scope reviewed:
- Prisma schema and initial migration
- Database design doc
- README setup changes
- Memory updates related to T-103/T-106

Verification run:
- `npm run db:format` — pass
- `npm run db:validate` — pass
- `npm run db:generate` — pass
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` — matches the committed migration except for the intentionally prepended `pgcrypto` extension statement

Live DB verification was not run because Supabase credentials are still blocked on T-102.

## Overall Assessment

This is a strong Day-1 database branch. It is appropriately scoped: no `user`,
no `subscription`, no `step_event`, no API code, and the four core tables map
cleanly to the accepted architecture. The schema is much closer to an interview
submission than a generic CRUD demo because it explicitly supports anonymous
resume, server-side result snapshots, entitlement gating, and payment
idempotency.

Do not merge yet: one numeric precision issue can turn a validation-accepted
submission into a database error on boundary inputs.

## Blocking

### B001 — `result.bmi decimal(4,2)` cannot store all validation-accepted BMI values

- Impact range: `prisma/schema.prisma`, initial migration, `docs/03-database-design.md`, and the future `/submit` calculator path.
- Risk reason: The API design admits `heightCm` down to 120 and `weightKg` up to 250. That valid input produces BMI `173.61`, but `decimal(4,2)` can store only up to `99.99`. A boundary-valid assessment would pass Zod, compute successfully, then fail at the database write. This directly risks the challenge's boundary-value scoring and could surface as a 500 during evaluator testing.
- Suggested fix: Change `result.bmi` to `decimal(5,2)` in Prisma, migration SQL, and DB docs. Keep the calculator and serializers unchanged. Add the future boundary fixture `heightCm=120`, `weightKg=250` to ensure submit does not overflow.

References:
- `prisma/schema.prisma:142`
- `prisma/migrations/20260518000000_init/migration.sql:63`
- `docs/03-database-design.md:134`

## Important

### I001 — Payment table does not backstop the "one successful payment per session" invariant

- Impact range: `payment` model, initial migration, `POST /api/v1/pay` implementation, double-pay tests.
- Risk reason: `UNIQUE (session_id, idempotency_key)` prevents same-key replay duplicates, but it does not prevent multiple successful rows for the same session with different idempotency keys. ADR-012 says already-paid sessions with a new key must no-op and insert no second payment. The future transaction can enforce this with `SELECT session FOR UPDATE`, but the current DB model does not provide a safety net if that handler is implemented incorrectly or later regresses.
- Suggested fix: Add a DB-level guard for one successful payment per session. If the MVP never records failed payment attempts, make `payment.session_id` unique. If keeping `failed` for audit flexibility, add a manual partial unique index in the migration: `CREATE UNIQUE INDEX payment_one_success_per_session_idx ON "payment"("session_id") WHERE "status" = 'succeeded';`, and document that it is intentionally SQL-only because Prisma cannot model partial indexes.

References:
- `prisma/schema.prisma:164-176`
- `prisma/migrations/20260518000000_init/migration.sql:75-104`
- `docs/03-database-design.md:155-160`

### I002 — Timestamp freshness relies on future manual updates

- Impact range: `session.updated_at`, `assessment.updated_at`, progress resume diagnostics, any future janitor/metrics query using `session(updated_at)`.
- Risk reason: Both fields have `@default(now())` but not Prisma `@updatedAt`. That means every future write path must remember to set them manually. The most likely miss is editing an already-completed step where `current_step` does not change; the saved answers change, but timestamps can stay stale. This weakens the partial-progress story and makes the `session(updated_at)` index less trustworthy.
- Suggested fix: Use Prisma `@updatedAt` on `Session.updatedAt` and `Assessment.updatedAt`, while keeping `@db.Timestamptz(6)`. If the team intentionally wants manual timestamps, create a small repository helper in the next branch and document that every write must go through it.

References:
- `prisma/schema.prisma:106-108`
- `prisma/schema.prisma:130`
- `docs/03-database-design.md:100-104`

### I003 — Payment text fields are wider than the API contract

- Impact range: `payment.idempotency_key`, `payment.currency`, future `/api/v1/pay` validation, payment unique index.
- Risk reason: The API contract caps `Idempotency-Key` at 128 chars and treats currency as ISO-4217, but the DB uses unbounded `text`. Zod should reject bad input, but DB modelling is one of the scored criteria and the unique index includes `idempotency_key`; unbounded indexed text leaves avoidable room for oversized values if a handler bug bypasses validation.
- Suggested fix: Use `@db.VarChar(128)` for `idempotencyKey` and `@db.Char(3)` or `@db.VarChar(3)` for `currency`. If the mock only supports USD, optionally add a simple DB check in SQL or keep that as a server constant plus a doc note.

References:
- `prisma/schema.prisma:167-170`
- `docs/04-api-design.md:289-291`
- `docs/03-database-design.md:149-152`

### I004 — API example uses a prefixed payment id while the schema stores UUIDs

- Impact range: `docs/04-api-design.md`, future `/api/v1/pay` response implementation, README cURL expectations.
- Risk reason: The API response example shows `"paymentId": "p_01HXY…"`, but `payment.id` is a UUID. If Claude follows the API doc literally in the next branch, the handler may invent a public prefixed id that does not exist in the DB, or the docs/tests may disagree with the actual persisted value.
- Suggested fix: Prefer the simpler MVP path: update the API example to show a UUID-shaped `paymentId`. Only introduce a prefixed public id if a separate `public_id` column is deliberately added, which is unnecessary for the challenge.

References:
- `docs/04-api-design.md:315`
- `prisma/schema.prisma:165`

## Nice-to-have

### N001 — README status is slightly stale for this branch

- Impact range: `README.md` status section.
- Risk reason: The README still says "Repository scaffold + design docs only" even though this branch now ships Prisma schema, migration, lockfile, and package setup. It also says no application code, which is true, but the first sentence understates current progress.
- Suggested fix: Change the status to "DB schema/migration shipped; no API or frontend application code yet." This keeps evaluator-facing docs crisp without expanding scope.

References:
- `README.md:35-39`

### N002 — Payment FK rationale wording is imprecise

- Impact range: `docs/03-database-design.md`.
- Risk reason: The doc says payments "must outlive any accidental session delete", but `ON DELETE RESTRICT` means the session delete is blocked; the payment row does not outlive a deleted session because the delete cannot proceed. The implementation choice is good; the wording is just slightly off.
- Suggested fix: Reword to "payments must prevent accidental session deletes from erasing audit data."

References:
- `docs/03-database-design.md:162-164`

### N003 — Migration runbook overstates bit-for-bit parity

- Impact range: `docs/03-database-design.md` migration runbook.
- Risk reason: The committed migration intentionally prepends `CREATE EXTENSION IF NOT EXISTS pgcrypto;`, so it is not bit-for-bit identical to raw `prisma migrate diff` output. The current meaning is clear to us, but an evaluator or future contributor may be confused while verifying the diff.
- Suggested fix: Reword to "matches Prisma's diff output, with the pgcrypto extension statement intentionally prepended."

References:
- `docs/03-database-design.md:196-201`

## Re-review — 2026-05-18

Branch reviewed: `feature/db-schema` at `cc40d3d`

Verification run:
- `npm run db:validate` — pass
- `npm run db:generate` — pass
- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` — matches the committed migration except for the two intentional SQL-only additions documented in `docs/03-database-design.md`: `pgcrypto` extension and `payment_one_success_per_session_idx`
- `git diff --check` — pass

### Blocking

None. B001 is resolved: `Result.bmi` is now `decimal(5,2)` in Prisma, migration SQL, and the table reference.

### Important

None. I001–I004 are resolved:
- I001: SQL-only partial unique index now backstops one successful payment per session.
- I002: `Session.updatedAt` and `Assessment.updatedAt` now use Prisma `@updatedAt`.
- I003: `Payment.idempotencyKey` is `varchar(128)` and `currency` is `char(3)`.
- I004: API example now shows a UUID-shaped `paymentId`.

### Nice-to-have

#### N004 — ER diagram type labels are stale after the schema fixes

- Impact range: `docs/03-database-design.md` ER diagram only.
- Risk reason: The table reference and Prisma schema are correct, but the Mermaid diagram still labels `RESULT.bmi` as `decimal_4_2` and `PAYMENT.idempotency_key` / `PAYMENT.currency` as `text`. This does not affect runtime behaviour, but the DB diagram is one of the stated deliverables, so stale type labels slightly weaken evaluator trust.
- Suggested fix: Update the diagram labels to `decimal_5_2`, `varchar_128`, and `char_3`.

References:
- `docs/03-database-design.md:67`
- `docs/03-database-design.md:80`
- `docs/03-database-design.md:83`

Merge recommendation: okay to merge after Claude either fixes N004 directly or records it as a small docs polish item. No Blocking or Important findings remain.
