# 03 — Database Design

> **Purpose.** Authoritative description of the Prisma schema: every
> table, every column, every enum, every index, plus an ER diagram.
> Pairs with `prisma/schema.prisma` and `prisma/migrations/`. The
> high-level model is locked by `docs/02-architecture.md` §3 and
> ADR-007/009; this doc fills in the exact field-level detail.
>
> **Owner.** Claude. Drafted Day 1 before the first migration.

## 1. Overview

Four required tables (`session`, `assessment`, `result`, `payment`) and
one optional table (`step_event`, deferred per ADR-009). Postgres on
Supabase. All ids are UUIDv4 (`crypto.randomUUID()`, ADR-004). All
timestamps are `timestamptz`.

## 2. ER diagram

*(To be added Day 1 / Day 5 as a Mermaid block.)*

## 3. Entities

For each table: columns, types, nullability, default, FK behaviour.

- `session` — *(Day 1)*
- `assessment` — *(Day 1)*
- `result` — *(Day 1)*
- `payment` — *(Day 1)*
- `step_event` *(optional, Day 5)*

## 4. Enums

- `session.status`, `session.current_step`, `session.entitlement_status`
- `assessment.gender`, `assessment.main_goal`, `assessment.activity_level`
- `result.bmi_category`
- `payment.status`

*(Exact members listed Day 1.)*

## 5. Indexes & constraints

- `payment (session_id, idempotency_key)` UNIQUE — enforces `/pay`
  idempotency (ADR-006).
- `result (session_id)` UNIQUE — one result per session.
- `assessment (session_id)` PK — one assessment row per session.
- `session (updated_at)` — for any future janitor / metrics job.

## 6. Migration notes

- Initial migration creates all four required tables.
- `step_event` ships in a later migration only if ADR-009 is reopened.
- Migrations are run via `npm run db:deploy` using `DIRECT_URL`
  (Supabase direct, not pooled). Pooler connections do not support
  migrations.
- No destructive migrations during the 5-day window without an ADR.
