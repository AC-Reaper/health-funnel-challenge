# Review 001: Architecture Draft v1

## Status

Resolved-in-design

Re-reviewed on 2026-05-18 after Claude's architecture v2, API v1, and
ADR-001…010 updates. Blocking architecture findings are resolved at the
design level; implementation verification remains pending in DB/API/final
reviews.

## Review Date

2026-05-18

## Reviewed File

- `docs/02-architecture.md`

## Reviewer Position

This is a 5-day interview challenge, not a production SaaS. The architecture should prove judgment: clear product loop, trustworthy server boundary, resumable funnel, paid-result gate, reproducible deployment, and enough engineering maturity without spending days on infrastructure polish.

Claude's proposal is directionally strong. I recommend approving the stack and core flow, but trimming audit/subscription complexity and fixing a few demo-path contradictions before implementation starts.

## 1. Parts I Agree With

- Next.js App Router + TypeScript in a single repo is the right 5-day choice. It keeps UI, route handlers, validation, and server-side computation close enough to move quickly.
- Supabase Postgres + Prisma is reasonable for the challenge if the team already accepts the setup cost. It gives a real DB story without building infrastructure.
- Anonymous signed httpOnly cookie is the right identity scope. Real auth would add work without improving the scoring criteria.
- Zod at API boundaries is worth keeping. It directly supports validation quality, typed request parsing, and field-level errors.
- Server-side result calculation and serializer-level result gating are the most important architecture choices in the proposal. These protect the score from looking like a client-only demo.
- Idempotent submit and payment flows are good interview signals. They show awareness of double-clicks, retries, and state consistency.
- Explicitly cutting real auth, real payments, GraphQL/tRPC, admin, APM, and multi-device resume is the right product judgment.

## 2. Over-Designed Parts

### Important: `step_event` audit table is probably too much for Day 1-3

- Impact range: DB schema, step save transaction, tests, seed/debug scripts.
- Risk reason: An append-only event table is useful in production, but for this challenge it adds implementation surface without being required for save/resume. It can distract from the visible funnel, result gate, and README demo.
- Suggested fix: Make `step_event` optional or defer it. Use `assessment.updated_at` and `session.current_step` for MVP. Add `step_event` only if core flows are complete by Day 4.

### Important: Separate `subscription` plus `payment_event` is more than the mock payment needs

- Impact range: DB schema, payment transaction, result authorization logic.
- Risk reason: For a one-time mock payment, a subscription state machine with `inactive | active | refunded`, expiry, and `last_payment_id` implies recurring entitlement semantics the challenge does not need.
- Suggested fix: Store entitlement directly on `session` (`paid_at` or `entitlement_status`) and keep one `payment` table for idempotency/audit. This still proves closed-loop payment without introducing SaaS billing concepts.

### Nice-to-have: UUIDv7 and in-memory rate limiting are unnecessary polish

- Impact range: dependencies, implementation time, Day 5 hardening.
- Risk reason: UUIDv7 ordering and demo-grade rate limiting will not meaningfully move the interview score. In-memory rate limiting is also unreliable on serverless.
- Suggested fix: Use `crypto.randomUUID()` unless Prisma/Supabase constraints require otherwise. Cut rate limiting unless the core app is done early.

## 3. Insufficient Parts

### Blocking: `/pay` is named as a requirement but the proposed API uses `/payments/checkout`

- Impact range: evaluator demo path, README, API routes, paywall UI.
- Risk reason: The challenge specifically calls out whether `/pay` forms a closed loop. If the public route is missing or named differently, the reviewer may treat the payment flow as incomplete even if the backend works.
- Suggested fix: Provide an actual `/pay` UI route and a clearly documented mock API route such as `POST /api/v1/pay`. The paywall CTA should navigate to `/pay`, and `/pay` should call the mock payment endpoint.

### Blocking: The proposed paid seed session conflicts with cookie-only auth

- Impact range: README demo, seed script, evaluator verification.
- Risk reason: The architecture says no endpoint trusts `session_id` in body/query, but also promises a pre-seeded paid `sessionId`. A raw `sessionId` is not enough to call `/results/me` if auth depends on a signed httpOnly cookie.
- Suggested fix: Do not depend on a paid seed session. Instead, document a cookie-jar cURL flow: create session, submit answers, get teaser, call `/pay`, get full result. If a seed is kept, seed and print a usable signed cookie value, not just the DB session id.

### Blocking: Step progression rule can mark progress incorrectly

- Impact range: `PATCH /sessions/me/steps/:stepKey`, resume logic, submit validation.
- Risk reason: The draft says out-of-order submission updates `current_step` as `max(completed_step, requested_step)`. A client could save step 6 first and appear complete enough to resume near the end even if required earlier answers are missing.
- Suggested fix: Either reject future-step saves when previous required steps are missing, or compute `current_step` as the first incomplete required step. Revisit earlier steps should remain allowed.

### Important: Requirements and API/database docs are still empty

- Impact range: `docs/01-requirements.md`, `docs/03-database-design.md`, `docs/04-api-design.md`, implementation consistency.
- Risk reason: The architecture references detailed schemas and contracts, but those files still say `TBD`. Without them, Claude can implement reasonable but unreviewed details that later break API quality or DB consistency.
- Suggested fix: Before heavy UI work, fill the DB and API docs with the selected reduced model and exact request/response/error contracts.

### Important: Open-question tracking is inconsistent

- Impact range: `docs/02-architecture.md`, `memory/open-questions.md`, cross-agent coordination.
- Risk reason: The architecture mentions Q002-Q005, but `memory/open-questions.md` still contains only a placeholder. This weakens coordination and makes owner sign-off ambiguous.
- Suggested fix: Replace placeholder open questions with the actual unresolved decisions, or remove the reference if the architecture decisions are now accepted.

## 4. Risks That Could Cause Challenge Failure

### Blocking: Spending too much time on invisible backend polish

- Impact range: Day 3-5 delivery, UI, README, deployed demo.
- Risk reason: Event audit, subscription abstractions, seed tricks, rate limits, and deployment details can consume the window while the evaluator only sees an incomplete funnel.
- Suggested fix: Prioritize the visible end-to-end path: create session → save steps → resume → submit → teaser result → `/pay` → full result.

### Blocking: Non-paid users may accidentally receive full-result data

- Impact range: `GET /results/me`, result serializer, frontend paywall.
- Risk reason: If the full `result` object is fetched client-side and hidden in UI, the main monetization/security criterion fails.
- Suggested fix: Implement separate teaser/full serializers. Tests should assert unpaid JSON does not contain calories, curve points, target date, or plan details.

### Important: The payment loop may look mocked but not closed

- Impact range: `/pay`, `POST /api/v1/pay`, DB state, result re-fetch.
- Risk reason: A fake button that only changes local UI state will fail the interview signal. The mock must write server state that immediately changes `GET /results/me`.
- Suggested fix: Payment endpoint must run in a transaction: create idempotent payment row, mark session paid, return subscription/entitlement status, then the result endpoint must return full data.

### Important: README demo path can become untestable

- Impact range: final submission, evaluator experience.
- Risk reason: Cookie-based flows are easy to document poorly. If the evaluator cannot reproduce payment and result access with browser or cURL, the project feels unfinished.
- Suggested fix: Use a cURL cookie jar example and a browser demo path. Avoid requiring manual cookie crafting.

## 5. Suggested Revised Data Model

Recommended MVP model: 4 required tables, 1 optional table.

### Required: `session`

- `id uuid primary key`
- `status enum('draft', 'submitted')`
- `current_step enum nullable`
- `created_at timestamp`
- `updated_at timestamp`
- `submitted_at timestamp nullable`
- `paid_at timestamp nullable`
- `entitlement_status enum('free', 'paid') default 'free'`

Reason: Keep identity, progress, submission, and paid entitlement in one place. This is enough for a one-time mock payment.

### Required: `assessment`

- `session_id uuid primary key references session(id)`
- `gender enum nullable`
- `main_goal enum nullable`
- `age_years int nullable`
- `height_cm int nullable`
- `weight_kg decimal nullable`
- `target_weight_kg decimal nullable`
- `activity_level enum nullable`
- `updated_at timestamp`

Reason: Nullable fields make partial save straightforward while still allowing typed columns and validation.

### Required: `result`

- `id uuid primary key`
- `session_id uuid unique references session(id)`
- `bmi decimal`
- `bmi_category enum`
- `daily_calories_kcal int`
- `predicted_target_date date nullable`
- `plan_json jsonb`
- `curve_points_json jsonb`
- `algorithm_version text`
- `computed_at timestamp`

Reason: Immutable snapshot makes paid/unpaid serialization reliable and avoids recomputing on every page load.

### Required: `payment`

- `id uuid primary key`
- `session_id uuid references session(id)`
- `idempotency_key text`
- `status enum('succeeded', 'failed')`
- `amount_cents int`
- `currency text`
- `created_at timestamp`
- unique `(session_id, idempotency_key)`

Reason: This is enough to prove retry safety and mock-payment audit. No separate subscription table is needed for MVP.

### Optional: `step_event`

Only add if core work is done:

- `id uuid primary key`
- `session_id uuid references session(id)`
- `step_key enum`
- `payload_json jsonb`
- `created_at timestamp`

Reason: Helpful for debugging and AI/funnel storytelling, but not necessary for scoring.

## 6. Suggested Revised API

Keep the API small and make the demo path obvious.

| Method | Path | Purpose | Key behavior |
| --- | --- | --- | --- |
| `POST` | `/api/v1/sessions` | Create or reuse anonymous session | Sets signed httpOnly cookie; returns session progress. |
| `GET` | `/api/v1/sessions/me` | Resume funnel | Returns `currentStep`, saved answers, `submitted`, and `entitlementStatus`. |
| `PATCH` | `/api/v1/sessions/me/steps/:stepKey` | Save one step | Validates only that step; rejects future steps if earlier required answers are missing; allows editing previous steps. |
| `POST` | `/api/v1/sessions/me/submit` | Finalize assessment | Re-validates all required answers; computes result server-side; idempotent if result already exists. |
| `GET` | `/api/v1/results/me` | Return gated result | Returns teaser for free sessions and full result for paid sessions. Serializer must omit paid-only fields for free users. |
| `GET` | `/pay` | Paywall/payment page | Browser route that shows mock payment CTA and calls API. |
| `POST` | `/api/v1/pay` | Mock payment | Requires `Idempotency-Key`; writes payment row and marks session paid in one transaction. |
| `GET` | `/api/v1/healthz` | Liveness | Simple deployment smoke test. |

I would cut `GET /api/v1/subscription/me` for MVP. `GET /sessions/me` can return `entitlementStatus`, and `GET /results/me` is the source of truth for gated output.

## 7. Final Recommended Plan

Approve these decisions immediately:

- Next.js 14 App Router + TypeScript.
- Supabase Postgres + Prisma.
- Vercel deployment.
- Anonymous signed httpOnly session cookie.
- Zod validation.
- Mock payment, not real Stripe/PayPal.

Modify the architecture before implementation:

- Rename the public payment flow around `/pay`.
- Remove the pre-seeded paid `sessionId` promise unless a usable signed cookie is provided.
- Replace `subscription` + `payment_event` with `session.entitlement_status/paid_at` + `payment`.
- Defer `step_event` until after the core loop works.
- Change step progress logic to first-incomplete-step or reject future steps.
- Fill `docs/03-database-design.md` and `docs/04-api-design.md` with exact reduced contracts.

Recommended delivery order:

1. Day 1: schema, session cookie, DB migration, API contracts.
2. Day 2: save/resume funnel with validation and first-incomplete-step progress.
3. Day 3: server-side calculator, submit, gated result, `/pay` transaction.
4. Day 4: UI, deploy, README cookie-jar cURL demo.
5. Day 5: tests for gating/idempotency/boundaries, collaboration log, final review fixes.

## Review Classification Summary

### Blocking

- `/pay` route/API naming mismatch with challenge expectations.
- Paid seed session is incompatible with cookie-only auth unless a signed cookie is provided.
- Step progression can mark incomplete assessments as advanced.
- Core loop must prioritize visible end-to-end delivery over invisible backend polish.
- Unpaid result serializer must never return paid-only fields.

### Important

- Defer `step_event`.
- Simplify payment/subscription modeling.
- Fill DB/API docs before implementation sprawls.
- Fix open-question tracking.
- Make README demo reproducible with cookie jar.

### Nice-to-have

- Use UUIDv4 unless UUIDv7 is already trivial.
- Cut serverless in-memory rate limiting unless everything else is done.
- Add audit events only after the challenge-critical flow is complete.
