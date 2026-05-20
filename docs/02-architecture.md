# Architecture

> Status: **v2 (current)** — Claude 2026-05-18, revised per
> `reviews/review-001-architecture.md`, with Day-5 hardening notes added
> 2026-05-19 (ADR-009 Accepted-and-shipped, ADR-014 server-side cookie
> TTL). Changes from v1: payment surface aligned to `/pay`; subscription
> model collapsed into `session`; step-progress rule fixed to
> first-incomplete-step; pre-seeded paid sessionId dropped in favour of a
> cookie-jar cURL demo; `step_event` shipped Day 5 as minimal append-only
> audit (T-502); cookie payload extended with `iat` for server-side TTL
> (T-501, ADR-014).
>
> **Decision gate**: ADR-001…015 in `memory/decisions.md` are Accepted.

## 0. Accepted decisions (ADR-001…015)

The accepted decisions that frame this architecture live in
`memory/decisions.md`. Short index — see ADR bodies for context,
rationale, and consequences:

| ADR | Decision | Status |
| - | - | - |
| ADR-001 | Web stack: Next.js App Router + TypeScript, single repo (scaffolded on 14; version baseline now ADR-015) | Accepted |
| ADR-002 | DB + ORM: PostgreSQL on Supabase + Prisma | Accepted |
| ADR-003 | Deploy: Vercel (app) + Supabase (DB) | Accepted |
| ADR-004 | Identity: anonymous signed httpOnly cookie holding `crypto.randomUUID()` | Accepted |
| ADR-005 | Validation: Zod at every API boundary; TS types derived from Zod | Accepted |
| ADR-006 | Payment: mocked `POST /api/v1/pay` + `/pay` browser page, `Idempotency-Key`, single-transaction write | Accepted |
| ADR-007 | Entitlement model: `session.entitlement_status` + `paid_at`, no separate `subscription` table | Accepted |
| ADR-008 | Step-progress rule: `current_step` = first incomplete required step | Accepted |
| ADR-009 | `step_event` audit table — minimal version shipped Day 5 (T-502) | Accepted |
| ADR-010 | No pre-seeded paid `sessionId`; README cookie-jar cURL walkthrough instead | Accepted |
| ADR-011 | Code management: feature branches + Conventional Commits + Codex review before merge | Accepted |
| ADR-012 | Payment replay: already-paid sessions silently no-op for new `Idempotency-Key` | Accepted |
| ADR-013 | Demo language and calculator defaults: English copy + Mifflin-St Jeor formula | Accepted |
| ADR-014 | Server-side cookie TTL via `iat` in HMAC payload (T-501) | Accepted |
| ADR-015 | Framework patch baseline: Next.js 15.5.18 for prod audit hygiene (amends ADR-001 version only) | Accepted |

---

## 1. MVP scope

**In scope** (smallest set that closes the loop the brief grades on):

1. Anonymous session creation + resume (single device, cookie-based).
2. 6-step funnel: `gender → main_goal → age → height → weight+target_weight → activity_level`. Each step validated and persisted on completion.
3. Server-side computation on submit: BMI + category (WHO bands), daily calorie target (Mifflin–St Jeor × activity factor), realistic target-weight date (bounded weekly delta).
4. Result page that is **server-gated**: free users see teaser (BMI + category + one-sentence narrative), paid users see full result (calories, target date, weight curve points).
5. Mock payment: a browser route `/pay` and a mock API `POST /api/v1/pay`. One transaction writes a `payment` row + sets `session.entitlement_status = 'paid'`; subsequent `GET /api/v1/results/me` returns the full payload.
6. Public Vercel URL + README with: setup, env vars, and a full cURL cookie-jar walkthrough (create → save steps → submit → teaser → pay → full). A separate Postman collection was scoped out — the cURL walkthrough is the canonical reproducer (see §9).

**Out of scope** — see §9.

---

## 2. User flow

```
[Landing / CTA]
       │
       ▼
POST /api/v1/sessions            ──► set signed httpOnly cookie (session_id)
       │
       ▼
Step 1 ─ PATCH /sessions/me/steps/gender
Step 2 ─ PATCH /sessions/me/steps/main_goal
   …                                          ◄── each step: zod-validated;
Step 6 ─ PATCH /sessions/me/steps/activity        upserts into assessment;
                                                  rejected if it would
                                                  skip a required earlier
                                                  step (editing earlier
                                                  steps is allowed)
       │
       │  (user can close tab / refresh at any point)
       ▼
GET /api/v1/sessions/me          ──► {currentStep, answers, submitted,
                                       entitlementStatus}
       │                              currentStep = first incomplete
       │                              required step
       ▼
POST /api/v1/sessions/me/submit
       │     ├─ re-validates the entire assessment
       │     ├─ runs HealthCalculator (server-only)
       │     └─ writes result row, marks session.submitted_at;
       │        idempotent — returns existing result on replay
       ▼
GET /api/v1/results/me           ──► teaser (entitlement_status = free)
                                      full   (entitlement_status = paid)
       │
       │  (paywall CTA navigates to /pay)
       ▼
GET /pay                         ──► browser route, mock payment form
       │
       ▼
POST /api/v1/pay                 ──► requires Idempotency-Key header
       │     ├─ unique (session_id, idempotency_key) — replays are no-ops
       │     └─ transaction: insert payment + set session.entitlement_status='paid'
       ▼
GET /api/v1/results/me           ──► full
```

The landing CTA is **state-aware** (`app/page.tsx` +
`lib/landing-cta.ts:resolveLandingCta`): a returning visitor sees
"Continue the quiz" (draft with progress → `/funnel`) or "View your
results" (submitted → `/results`) instead of a misleading "Start the
quiz" that would silently redirect a submitted session to `/results`.
An explicit "start over" / restart is deferred (open-questions Q-007).

Edge / error paths the design must cover:

- Refresh mid-step → cookie persists → `GET /sessions/me` restores progress.
- Cookie loss → starts a new session (documented limitation, §9).
- Saving a step that skips required earlier steps → `409 STEP_OUT_OF_ORDER` with a pointer to the first incomplete step. Editing an already-completed earlier step is allowed.
- `current_step` is always recomputed server-side as "first incomplete required step", never trusted from the client.
- Double `/submit` → returns the existing `result` (no recompute).
- Double `/pay` with same `Idempotency-Key` → returns existing payment + entitlement, no double-write.
- Double `/pay` with **different** `Idempotency-Key` on an already-paid session → silently no-ops, returns existing paid entitlement, and does not insert a second `payment` row (ADR-012).
- Invalid numeric inputs (e.g. age < 13, height > 250, weight ≤ 0, target weight diverging > 30% from current) → rejected at the Zod boundary with field-level errors. The 30% divergence rule comes from the calculator (ADR-013).
- Calling `/results/me` before submit → `409 NOT_SUBMITTED`.
- Calling `/results/me` for a non-existent session (no cookie / tampered cookie) → `401 NO_SESSION`.

---

## 3. Data model (logical)

Four required tables, one optional. Exact Prisma schema lives in `docs/03-database-design.md` (Day 1).

**`session`** — one row per anonymous funnel attempt; also holds entitlement.
- `id uuid pk` (`crypto.randomUUID()`)
- `status enum('draft','submitted') default 'draft'`
- `current_step enum nullable` (cache; canonical value recomputed from `assessment`)
- `entitlement_status enum('free','paid') default 'free'`
- `paid_at timestamp nullable`
- `submitted_at timestamp nullable`
- `created_at timestamp`, `updated_at timestamp`
- `user_agent text nullable` (best-effort diagnostics)

**`assessment`** — one row per session; nullable columns are the partial-progress mechanism.
- `session_id uuid pk fk → session.id`
- `gender enum nullable`
- `main_goal enum nullable`
- `age_years int nullable`
- `height_cm int nullable`
- `weight_kg decimal(5,2) nullable`
- `target_weight_kg decimal(5,2) nullable`
- `activity_level enum nullable`
- `updated_at timestamp`

**`result`** — immutable snapshot per submitted session.
- `id uuid pk`
- `session_id uuid unique fk → session.id`
- `bmi decimal(5,2)` (widened per review-003 B001; the API-admitted boundary `heightCm=120, weightKg=250` yields BMI ≈ 173.61, which overflows a narrower type)
- `bmi_category enum('underweight','normal','overweight','obese_i','obese_ii','obese_iii')`
- `daily_calories_kcal int`
- `predicted_target_date date nullable` (null when goal is unrealistic; see §calculator)
- `curve_points_json jsonb` (`[{week:int, weight:decimal}]`)
- `plan_json jsonb nullable` (free-form narrative blocks; may be `{}` if Day 3 runs tight)
- `algorithm_version text` (e.g. `"v1.0.0-mifflin"`)
- `computed_at timestamp`

**`payment`** — one row for the first successful mock payment idempotency key. Same-key replays select the existing row; already-paid new-key calls no-op without inserting a second row.
- `id uuid pk`
- `session_id uuid fk → session.id`
- `idempotency_key varchar(128)` (width pinned by the API contract cap; review-003 I003)
- `status enum('succeeded','failed')`
- `amount_cents int` (server constant for the demo)
- `currency char(3)` (ISO-4217 fixed-width; review-003 I003)
- `created_at timestamp`
- `UNIQUE (session_id, idempotency_key)`

**`step_event`** (ADR-009, shipped Day 5 / T-502) — append-only audit of every successful PATCH on `/sessions/me/steps/:stepKey`.
- `id uuid pk`, `session_id uuid fk → session.id ON DELETE CASCADE`, `step_key enum`, `value_json jsonb`, `created_at timestamptz default now()`.
- Written inside the same `db.$transaction` as the assessment write, so the audit cannot disagree with the data row. No unique constraint — replays are valid audit data showing the user's input cadence.

Index notes: `session(updated_at)` for any janitor job; `payment(session_id, idempotency_key) UNIQUE` (idempotency); `payment(session_id) WHERE status='succeeded'` UNIQUE partial (ADR-012 backstop, SQL-only); `result(session_id) UNIQUE`; `step_event(session_id, created_at)` btree for audit reads; `session(id)` is the cookie's only key.

---

## 4. Calculator (server-only, deterministic, versioned)

Lives at `lib/health/calculator.ts`, pure function `compute(assessment): Result`.

- **BMI** = `weight_kg / (height_m)^2`, banded to WHO categories (`underweight < 18.5`, `normal 18.5–24.9`, `overweight 25–29.9`, `obese_i 30–34.9`, `obese_ii 35–39.9`, `obese_iii ≥ 40`).
- **BMR** = Mifflin–St Jeor (gender-dependent).
- **TDEE** = BMR × activity factor (`sedentary 1.2`, `light 1.375`, `moderate 1.55`, `active 1.725`, `very_active 1.9`).
- **Daily target** = TDEE − 500 (loss) / + 300 (gain) / 0 (maintain), clamped to a safe floor (`≥ 1200 kcal female, ≥ 1500 kcal male`).
- **Target date**: weekly delta of ±0.5 kg per week. If `|target − current| / current > 0.30` → return `predicted_target_date = null` and a `plan_json.note = "consult_professional"` flag.
- **`algorithm_version`** is bumped on any formula change so old results stay reproducible.

The calculator is fixture-tested across the boundary set the validation layer admits. Tests assert the function is pure (no I/O).

---

## 5. Permissions & subscription logic

- The **server** is the only source of truth for entitlement. The client receives `entitlementStatus` only to render the paywall affordance; every gated endpoint re-checks `session.entitlement_status`.
- `GET /api/v1/results/me` branches:
  ```
  if session.entitlement_status == 'paid'  → full serializer
  else                                     → teaser serializer
  ```
  - Two separate serializer modules in `lib/serializers/result.ts`. The teaser serializer is **incapable** of emitting `daily_calories_kcal`, `predicted_target_date`, `curve_points_json`, or `plan_json` — these fields are not in its return type. A unit test JSON-stringifies the teaser response and asserts those substrings are absent, so a future drift cannot leak data through.
- `POST /api/v1/pay` does **not** trust the client for `amount_cents` / `currency`. They are server constants. The transaction is:
  ```
  BEGIN
    SELECT session FOR UPDATE
    if session.entitlement_status == 'paid':
      if this idempotency_key already has a payment row → return that payment (same-key replay)
      else → return existing paid entitlement (new-key no-op, no payment insert)
    else:
      INSERT INTO payment (... idempotency_key ...)  -- ON CONFLICT (session_id, idempotency_key) DO NOTHING RETURNING *
      if no row was inserted → SELECT the existing payment, return it (same-key replay)
      UPDATE session SET entitlement_status='paid', paid_at=now()
  COMMIT
  ```
  Idempotency is therefore enforced by the DB unique constraint, not by application logic.
- No roles, no admin, no JWT. The cookie is signed (HMAC, `SESSION_COOKIE_SECRET`), httpOnly, `SameSite=Lax`, `Secure` in prod, ~30-day max-age.
- Baseline response headers (XCTO / XFO / Referrer-Policy /
  Permissions-Policy / a conservative `frame-ancestors`-only CSP)
  ship from `next.config.mjs:headers()` on every route; personalised
  `/api/v1` responses additionally carry `Cache-Control: private,
  no-store, max-age=0`. Optional `APP_ORIGIN` env var pins the
  origin used by server-side internal fetches in production (falls
  back to `x-forwarded-*` headers when unset). See
  `docs/08-security-hardening.md` §3.1–§3.3.

---

## 6. Deployment

- **App**: Vercel project, region `iad1`. Build: `prisma generate && next build`.
- **DB**: Supabase Postgres. Two env vars:
  - `DATABASE_URL` → pgBouncer pooled URL (runtime / serverless).
  - `DIRECT_URL` → direct URL (only for `prisma migrate deploy`).
- **Migrations**: `prisma/migrations` checked in; `npm run db:deploy` runs `prisma migrate deploy` against `DIRECT_URL`.
- **Seed**: `prisma/seed.ts` is minimal — it does **not** create a "paid demo session", because cookie-only auth makes a bare `sessionId` un-callable from outside the browser. Instead the README walks the evaluator through a 5-line cURL cookie-jar flow that creates, submits, pays, and reads in their own session.
- **Secrets** (Vercel env): `DATABASE_URL`, `DIRECT_URL`, `SESSION_COOKIE_SECRET`, `NODE_ENV`.
- **Logs**: Vercel built-in + JSON-structured `console.log`. No Sentry / APM (§9).

---

## 7. Five-day plan

Each day ends at a Codex review trigger so quality is loaded throughout, not bolted on Day 5.

**Day 1 — Foundations** *(historical note: started 2026-05-18 against the ADRs accepted at that time; ADR-014 was added on Day 5)*
- T-101 `package.json` + Next.js 14 App Router skeleton.
- T-102 Prisma init + Supabase project provisioned.
- T-103 `docs/03-database-design.md` + first migration (`session`, `assessment`, `result`, `payment`).
- T-104 `lib/session.ts` — signed-cookie create / read / verify.
- T-105 Endpoints: `POST /api/v1/sessions`, `GET /api/v1/sessions/me`, `GET /api/v1/healthz`.
- T-106 Trigger Codex `review-001-architecture.md` re-review + `review-003-db.md`.

**Day 2 — Funnel persistence**
- T-201 Zod step schemas in `lib/validation/steps.ts`.
- T-202 `PATCH /api/v1/sessions/me/steps/:stepKey` — per-step validation; upsert; **first-incomplete-step** progress rule; allow editing earlier steps.
- T-203 Boundary tests (age 12/13/100/101; weight 0; target_weight vs goal coherence; out-of-order step rejection).
- T-204 Trigger Codex `review-002-api.md`.

**Day 3 — Submit / calculate / gate / pay**
- T-301 `lib/health/calculator.ts` — pure, deterministic, versioned, fixture-tested.
- T-302 `POST /api/v1/sessions/me/submit` (idempotent).
- T-303 `GET /api/v1/results/me` with two-serializer gating + a leak test.
- T-304 `POST /api/v1/pay` with single-transaction idempotency.

**Day 4 — UI + deploy** *(shipped on `feature/frontend-funnel`)*
- T-401 ✅ Funnel UI (one step per screen, progress bar, server-driven resume, sticky CTA, paywall modal).
- T-402 ✅ `/pay` browser route — server-component branch on `GET /results/me` (closes review-006 N003).
- T-403 ✅ Deployed to Vercel + Supabase; cookie-jar cURL verified against prod.
- T-404 ✅ README — setup, env table, full cookie-jar cURL walkthrough.

**Day 5 — Hardening, AI log, final review** *(shipped on `feature/day5-hardening`)*
- T-501 ✅ Edge cases: refresh mid-step, double-submit, double-pay same-key replay, already-paid new-key no-op, tampered cookie, expired cookie (server-side TTL via `iat`, ADR-014).
- T-502 ✅ `step_event` audit table + writes (ADR-009 Accepted-and-shipped).
- T-503 ✅ Schema Mermaid in `docs/03-database-design.md` (incl. `step_event`).
- T-504 ✅ `docs/05-ai-collaboration-log.md` per-phase retrospectives.
- T-505 In progress — Codex review-004-final returned (0 Blocking, 3 Important, 1 Nice-to-have); closeout in flight.

---

## 8. Risks

| # | Risk | Likelihood | Impact | Mitigation |
| - | - | - | - | - |
| R1 | Supabase pooler vs Prisma migration mismatch | Med | High | Document both env vars Day 1; smoke-test `prisma migrate deploy` on Day 1, not Day 4. |
| R2 | Day 4 UI slips → funnel feels untrustworthy, brief explicitly grades this | Med | High | Day 4 dedicated; copy + visual baseline sketched Day 1 in parallel; willing to drop 6→5 steps. |
| R3 | `/pay` looks toy, loses "支付回调闭环" points | Med | Med | `Idempotency-Key` header + DB-enforced unique + single transaction + cookie-jar cURL doc. |
| R4 | Calculator subtle bugs (BMI edges, unrealistic target date) | Med | Med | Pure function, versioned, fixture-tested; refuses to predict if Δ > 30% of current weight. |
| R5 | Cookie identity = single device only; evaluator tries two browsers, gets confused | Low | Med | Documented limitation in README and §9. |
| R6 | Vercel cold start makes first click feel broken | Low | Low | README tells the evaluator to hit `/healthz` first. |
| R7 | Free-result endpoint leaks paid fields | Low | High | Two-serializer design + leak test in CI. |
| R8 | Implementation starts before accepted ADRs are recorded → rework | Low | High | ADR-001…015 are accepted; future scope changes require new ADRs. |

---

## 9. What we are deliberately not doing

| Cut | Why |
| - | - |
| Real auth (email / OAuth / magic link) | Brief permits session-based ID. Adds ~1 day, doesn't move any scoring criterion. |
| Real payment provider | Brief asks for mock. We mimic webhook idempotency semantics so the design still scores. |
| `subscription` table + state machine + `expires_at` | One-time mock payment doesn't need recurring entitlement. Collapsed into `session.entitlement_status` + `paid_at`. |
| Multi-device / cross-device resume | Anonymous cookie can't address this without real auth. Documented as a limitation, not a defect. |
| I18n | Demo single-language English first (ADR-013). Chinese copy can be added later if time remains. |
| A/B testing, growth instrumentation | Not in scope. `step_event` ships as the minimal audit substrate; analytics would build on top. |
| ML / personalised recommendations | Brief asks for "a simple algorithm". Deterministic + versioned + testable wins over clever. |
| Email / notifications | No identity → no email. |
| Admin dashboard | Not graded; Supabase SQL editor suffices. |
| Sentry / APM | Vercel logs are enough for the demo window. |
| Rate limiting beyond DB-enforced idempotency | In-memory limits are unreliable on serverless. `docs/08-security-hardening.md` §5 points to Upstash/Vercel KV throttling `/sessions` and `/pay` first as the prod path. |
| GraphQL / tRPC | Brief evaluates REST path/method design. Adding either would obscure that signal. |
| Pre-seeded paid `sessionId` | Cookie-only auth makes a raw UUID unusable from outside the browser; replaced with a cURL cookie-jar walkthrough in the README. |
| UUIDv7 | No measurable benefit at this scale; using `crypto.randomUUID()` instead. |
| Postman collection | The README cURL cookie-jar walkthrough is the canonical reproducer; a Postman collection would duplicate it without adding evaluator value. |

---

## 10. Open follow-ups

None for the submitted MVP. `docs/03-database-design.md` and
`docs/04-api-design.md` are current as of 2026-05-19;
`memory/open-questions.md` Q-001…Q-006 are all resolved. The only
remaining tasks before submission are owner actions in
`docs/07-delivery-checklist.md` §Submission.
