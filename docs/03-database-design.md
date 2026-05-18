# 03 — Database Design

> **Purpose.** Authoritative description of the Prisma schema: every
> table, every column, every enum, every index, plus an ER diagram.
> Pairs with `prisma/schema.prisma` and `prisma/migrations/`. The
> high-level model is locked by `docs/02-architecture.md` §3 and
> ADR-007/009/012; this doc fills in the exact field-level detail.
>
> **Owner.** Claude. Drafted on `feature/db-schema` 2026-05-18 alongside
> the first migration.

## 1. Overview

Four tables on Postgres / Supabase:

- `session` — anonymous funnel attempt + entitlement.
- `assessment` — 1:1 with session; the user's quiz answers.
- `result` — 1:1 with submitted session; immutable computation snapshot.
- `payment` — N:1 with session; audit + idempotency for the mock `/pay`.

Out of this schema, by accepted decisions:

- No `user` table — anonymous-only identity (ADR-004).
- No `subscription` table — entitlement collapsed into `session` (ADR-007).
- No `step_event` audit table on Day 1 — deferred (ADR-009); may ship on Day 5.

All ids are UUIDv4 — DB default via `gen_random_uuid()` (pgcrypto), with
app code using `crypto.randomUUID()` for explicit control. All timestamps
are `timestamptz`. Money is stored as integer `amount_cents` + ISO-4217
`currency` text.

## 2. ER diagram

```mermaid
erDiagram
    SESSION ||--o| ASSESSMENT : "1:0..1"
    SESSION ||--o| RESULT     : "1:0..1"
    SESSION ||--o{ PAYMENT    : "1:0..n"

    SESSION {
        uuid                id PK
        session_status      status
        step_key            current_step
        entitlement_status  entitlement_status
        timestamptz         paid_at
        timestamptz         submitted_at
        timestamptz         created_at
        timestamptz         updated_at
        text                user_agent
    }

    ASSESSMENT {
        uuid           session_id PK,FK
        gender         gender
        main_goal      main_goal
        int            age_years
        int            height_cm
        decimal_5_2    weight_kg
        decimal_5_2    target_weight_kg
        activity_level activity_level
        timestamptz    updated_at
    }

    RESULT {
        uuid          id PK
        uuid          session_id FK,UQ
        decimal_4_2   bmi
        bmi_category  bmi_category
        int           daily_calories_kcal
        date          predicted_target_date
        jsonb         curve_points_json
        jsonb         plan_json
        text          algorithm_version
        timestamptz   computed_at
    }

    PAYMENT {
        uuid           id PK
        uuid           session_id FK
        text           idempotency_key
        payment_status status
        int            amount_cents
        text           currency
        timestamptz    created_at
    }
```

## 3. Entities

### `session`

| Column | Type | Null | Default | Notes |
| - | - | - | - | - |
| `id` | `uuid` | no | `gen_random_uuid()` | Cookie holds this signed (ADR-004). |
| `status` | `session_status` | no | `'draft'` | Becomes `'submitted'` after `/submit`. |
| `current_step` | `step_key` | yes | — | Cache. Canonical value recomputed in app code as the first incomplete required step (ADR-008). |
| `entitlement_status` | `entitlement_status` | no | `'free'` | Server-trusted gate for `/results/me`. |
| `paid_at` | `timestamptz` | yes | — | Set in the same transaction as the entitlement flip (ADR-006). |
| `submitted_at` | `timestamptz` | yes | — | Set by `/submit`. |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Touched by app code on every write. No DB trigger — we keep DB-side magic to zero. |
| `user_agent` | `text` | yes | — | Best-effort diagnostics. |

Indexes: `(updated_at)` btree. Primary key on `id`.

### `assessment`

| Column | Type | Null | Default | Notes |
| - | - | - | - | - |
| `session_id` | `uuid` | no | — | PK + FK → `session.id`. Cascade on delete. |
| `gender` | `gender` | yes | — | |
| `main_goal` | `main_goal` | yes | — | |
| `age_years` | `int` | yes | — | Range enforced by Zod (13–100, ADR-005). |
| `height_cm` | `int` | yes | — | Zod range 120–230. |
| `weight_kg` | `decimal(5,2)` | yes | — | Zod range 30–250. |
| `target_weight_kg` | `decimal(5,2)` | yes | — | Cross-checked against `weight_kg` and `main_goal` at the API layer. |
| `activity_level` | `activity_level` | yes | — | |
| `updated_at` | `timestamptz` | no | `now()` | |

Why all columns nullable: this is the partial-progress mechanism. A
single row exists per session from step 1; columns fill in as the user
proceeds. Why no DB CHECK constraints: ADR-005 puts validation at the
Zod boundary; duplicating it in two places would risk drift.

### `result`

Immutable snapshot. We never overwrite a row — algorithm-versioning
relies on the snapshot being frozen.

| Column | Type | Null | Default | Notes |
| - | - | - | - | - |
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `session_id` | `uuid` | no | — | UNIQUE + FK → `session.id`. Cascade on delete. |
| `bmi` | `decimal(4,2)` | no | — | e.g. `24.91`. |
| `bmi_category` | `bmi_category` | no | — | WHO bands (`underweight`…`obese_iii`). |
| `daily_calories_kcal` | `int` | no | — | Floored at 1200 (female) / 1500 (male) by the calculator. |
| `predicted_target_date` | `date` | yes | — | `NULL` when the goal is unrealistic (`|target − current| / current > 0.30`). |
| `curve_points_json` | `jsonb` | no | `'[]'::jsonb` | `[{"week":int,"weightKg":number}]`. |
| `plan_json` | `jsonb` | yes | — | Free-form narrative blocks. May be `{}` if Day-3 time is tight (per `docs/02-architecture.md` §3). |
| `algorithm_version` | `text` | no | — | e.g. `"v1.0.0-mifflin"`. Bumped on any formula change. |
| `computed_at` | `timestamptz` | no | `now()` | |

### `payment`

| Column | Type | Null | Default | Notes |
| - | - | - | - | - |
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `session_id` | `uuid` | no | — | FK → `session.id`. **RESTRICT** on delete, not CASCADE. |
| `idempotency_key` | `text` | no | — | Client-supplied. |
| `status` | `payment_status` | no | — | `succeeded` or `failed`. |
| `amount_cents` | `int` | no | — | Server constant; never trusts the client. |
| `currency` | `text` | no | — | Server constant. |
| `created_at` | `timestamptz` | no | `now()` | |

Constraint: `UNIQUE (session_id, idempotency_key)`. This single constraint
is what makes `POST /api/v1/pay` replay-safe by construction (ADR-006).
The application handler uses `INSERT … ON CONFLICT DO NOTHING` then
either selects the existing row (same-key replay) or — if the session is
already `paid` — skips the insert entirely and returns the existing
entitlement (already-paid no-op, ADR-012).

FK behaviour rationale: payments are audit data and must outlive any
accidental session delete. CASCADE on `assessment` and `result` is fine
because those are derived from the session.

## 4. Enums

Postgres native enums (Prisma `@@map` for snake_case at the DB layer).

| Enum | Members |
| - | - |
| `session_status` | `draft`, `submitted` |
| `step_key` | `gender`, `main_goal`, `age`, `height`, `weight`, `activity` |
| `entitlement_status` | `free`, `paid` |
| `gender` | `female`, `male` |
| `main_goal` | `lose_weight`, `maintain`, `gain_weight`, `build_muscle` |
| `activity_level` | `sedentary`, `light`, `moderate`, `active`, `very_active` |
| `bmi_category` | `underweight`, `normal`, `overweight`, `obese_i`, `obese_ii`, `obese_iii` |
| `payment_status` | `succeeded`, `failed` |

Adding an enum value requires a new migration. Renaming or removing one
requires an ADR.

## 5. Indexes & constraints

- `session(updated_at)` btree — for any janitor/metrics job.
- `result(session_id)` UNIQUE — one result per session.
- `payment(session_id, idempotency_key)` UNIQUE — enforces idempotency.
- `assessment(session_id)` is the primary key (implicit unique).
- No additional FK indexes added: Postgres creates an index for primary
  keys and unique constraints automatically; the `payment.session_id`
  column is covered by the composite unique above.

## 6. Migration runbook

- Initial migration: `prisma/migrations/20260518000000_init/migration.sql`.
  Generated with `prisma migrate diff --from-empty
  --to-schema-datamodel prisma/schema.prisma --script` to guarantee
  bit-for-bit parity with `schema.prisma`. A `CREATE EXTENSION IF NOT
  EXISTS pgcrypto;` is prepended so `gen_random_uuid()` works on any
  Postgres install (Supabase already enables it).
- To apply against Supabase (or any Postgres):
  1. `cp .env.example .env` and fill `DATABASE_URL` (pooled) and
     `DIRECT_URL` (direct). Supabase exposes both in the project's
     **Connection** settings.
  2. `npm install`
  3. `npm run db:deploy` (runs `prisma migrate deploy` against
     `DIRECT_URL`; the pooler does not support migrations).
  4. Sanity check: `psql "$DIRECT_URL" -c "\dt"` lists the four tables.
- For schema changes after this branch: edit `prisma/schema.prisma`,
  then `npx prisma migrate dev --name <slug>` (requires a dev Postgres
  reachable via `DIRECT_URL`; this generates a new timestamped
  migration). Never edit a shipped migration in place.
- No destructive migrations during the 5-day window without an ADR.
- `step_event` (ADR-009) will ship behind its own migration if reopened
  on Day 5.
