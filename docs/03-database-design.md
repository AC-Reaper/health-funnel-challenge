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

Five **domain** tables on Postgres / Supabase, plus one **operational**
table (`rate_limit`):

- `session` — anonymous funnel attempt + entitlement.
- `assessment` — 1:1 with session; the user's quiz answers.
- `result` — 1:1 with submitted session; immutable computation snapshot.
- `payment` — N:1 with session; audit + idempotency for the mock `/pay`.
- `step_event` — N:1 with session; append-only audit of every successful
  PATCH on `/sessions/me/steps/:stepKey` (ADR-009, T-502, shipped Day 5).
- `rate_limit` — **operational**, not a domain entity and not linked to
  `session`. Backs the best-effort fixed-window rate limiter (ADR-016):
  one row per `(route, identity-hash, time-window)`, `count` incremented
  per request, `expires_at` indexed for pruning. Identity is a keyed
  HMAC-SHA256 (peppered with `SESSION_COOKIE_SECRET`) of IP + session id +
  User-Agent, so no raw IP/UA is stored.

Out of this schema, by accepted decisions:

- No `user` table — anonymous-only identity (ADR-004).
- No `subscription` table — entitlement collapsed into `session` (ADR-007).

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
    SESSION ||--o{ STEP_EVENT : "1:0..n"

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
        decimal_5_2   bmi
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
        varchar_128    idempotency_key
        payment_status status
        int            amount_cents
        char_3         currency
        timestamptz    created_at
    }

    STEP_EVENT {
        uuid           id PK
        uuid           session_id FK
        step_key       step_key
        jsonb          value_json
        timestamptz    created_at
    }
```

Not visualised: the partial unique index `payment_one_success_per_session_idx`
on `payment(session_id) WHERE status='succeeded'` (Prisma cannot model
partial indexes, so it lives in `migration.sql` only). It backstops
ADR-012's "exactly one successful payment per session" invariant.

## 2.1 Logical model mapping

The challenge brief uses User / Subscription / Payment vocabulary. The
shipped schema deliberately collapses it down to the minimum surface a
5-day anonymous-funnel demo needs. Mapping below; rationale lives in
the referenced ADRs.

| Brief concept | Shipped representation | Decision |
| - | - | - |
| User | Anonymous `session` row + HMAC-signed httpOnly cookie | ADR-004 |
| Account / login flow | Out of scope | ADR-004 |
| Subscription / Entitlement | `session.entitlement_status` (`free` / `paid`) + `session.paid_at` | ADR-007 |
| Recurring subscription billing cycle | Out of scope (one-time mock) | ADR-006 |
| Payment record | `payment` table — DB `UNIQUE (session_id, idempotency_key)` + partial unique index `payment_one_success_per_session_idx WHERE status='succeeded'` | ADR-006, ADR-012 |
| Step-progression audit | `step_event` (append-only, written inside the PATCH transaction) | ADR-009 |

The collapse is intentional. The brief permits anonymous sessions and
asks for a *mocked* payment, so a separate `user` table would add an
auth surface that scores zero, and a separate `subscription` table
would either duplicate `session.entitlement_status` or require a state
machine for a non-existent billing cycle. The current shape preserves
every scored behaviour (resume, idempotency, gated reads,
replay-safety) with one fewer FK and one fewer migration than the
brief's nominal data model — see `docs/02-architecture.md` §9
"deliberately not doing".

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
| `updated_at` | `timestamptz` | no | — (Prisma `@updatedAt`) | Refreshed by the Prisma client on every write, including step edits that leave `current_step` unchanged. No DB trigger. |
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
| `updated_at` | `timestamptz` | no | — (Prisma `@updatedAt`) | Refreshed on every write through the Prisma client. |

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
| `bmi` | `decimal(5,2)` | no | — | e.g. `24.91`. Width 5 (not 4) so the API-admitted boundary `heightCm=120, weightKg=250` (BMI ≈ 173.61) fits without overflow. |
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
| `idempotency_key` | `varchar(128)` | no | — | Client-supplied. Width matches the API contract cap so an oversized key cannot pass DB write even if validation regressed. |
| `status` | `payment_status` | no | — | `succeeded` or `failed`. |
| `amount_cents` | `int` | no | — | Server constant; never trusts the client. |
| `currency` | `char(3)` | no | — | ISO-4217 fixed-width. Server constant. |
| `created_at` | `timestamptz` | no | `now()` | |

Constraints, two layers:

1. `UNIQUE (session_id, idempotency_key)` — makes `POST /api/v1/pay`
   replay-safe by construction (ADR-006). Same-key replays converge on
   the same row via `INSERT … ON CONFLICT DO NOTHING`.
2. `payment_one_success_per_session_idx` — a **partial unique index** on
   `(session_id) WHERE status = 'succeeded'`, defined only in the
   migration SQL because Prisma cannot model partial indexes. This is
   the DB-level backstop for ADR-012: even if a future handler bug
   tried to insert a second succeeded payment with a different
   idempotency key, the DB would refuse. `failed` rows are unaffected,
   so audit flexibility is preserved.

FK behaviour rationale: payments are audit data, and the `RESTRICT`
constraint prevents accidental session deletes from erasing that audit
data (it does **not** mean payment rows outlive a successful delete —
the delete is blocked outright). CASCADE on `assessment` and `result`
is fine because those are derived from the session.

### `step_event`

Append-only audit. One row per successful PATCH
`/sessions/me/steps/:stepKey`. Written inside the same transaction as
the assessment write so the audit can never disagree with the data
(ADR-009, T-502).

| Column | Type | Null | Default | Notes |
| - | - | - | - | - |
| `id` | `uuid` | no | `gen_random_uuid()` | |
| `session_id` | `uuid` | no | — | FK → `session.id`. **CASCADE** on delete. |
| `step_key` | `step_key` | no | — | Which step the user just answered. |
| `value_json` | `jsonb` | no | — | Parsed Zod body verbatim (e.g. `{"gender":"female"}`, `{"weightKg":80,"targetWeightKg":70}`). |
| `created_at` | `timestamptz` | no | `now()` | |

Index: `(session_id, created_at)` btree. No unique constraint — replays
write additional rows so the audit reflects the user's input cadence.

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
- `payment(session_id, idempotency_key)` UNIQUE — enforces same-key idempotency (ADR-006).
- `payment(session_id) WHERE status='succeeded'` UNIQUE (partial) — backstops ADR-012 "one successful payment per session". Defined in SQL only; Prisma cannot model partial indexes.
- `step_event(session_id, created_at)` btree — supports audit reads ordered by time per session.
- `assessment(session_id)` is the primary key (implicit unique).
- No additional FK indexes added: Postgres creates an index for primary
  keys and unique constraints automatically; the `payment.session_id`
  and `step_event.session_id` columns are covered by the composite
  unique / composite btree above.

## 6. Migration runbook

- Initial migration: `prisma/migrations/20260518000000_init/migration.sql`.
  Matches Prisma's `migrate diff --from-empty --to-schema-datamodel
  --script` output, with two intentional additions:
  1. `CREATE EXTENSION IF NOT EXISTS pgcrypto;` prepended, so
     `gen_random_uuid()` works on any Postgres install (Supabase
     already enables it).
  2. The partial unique index
     `payment_one_success_per_session_idx` appended at the end,
     because Prisma cannot model partial indexes (see §5).
- Day-5 follow-up migration: `prisma/migrations/20260519000000_add_step_event/migration.sql`.
  Adds the `step_event` table + `(session_id, created_at)` index + FK
  with `ON DELETE CASCADE`. Standard `prisma migrate diff` output, no
  manual edits.
- To apply against Supabase (or any Postgres):
  1. `cp .env.example .env` and fill `DATABASE_URL` (pooled) and
     `DIRECT_URL` (direct). Supabase exposes both in the project's
     **Connection** settings.
  2. `npm install`
  3. `npm run db:deploy` (runs `prisma migrate deploy` against
     `DIRECT_URL`; the pooler does not support migrations). Applies
     both `20260518000000_init` and `20260519000000_add_step_event`.
  4. Sanity check: `psql "$DIRECT_URL" -c "\dt"` lists the five tables
     (`session`, `assessment`, `result`, `payment`, `step_event`).
- For schema changes after this branch: edit `prisma/schema.prisma`,
  then `npx prisma migrate dev --name <slug>` (requires a dev Postgres
  reachable via `DIRECT_URL`; this generates a new timestamped
  migration). Never edit a shipped migration in place.
- No destructive migrations during the 5-day window without an ADR.
