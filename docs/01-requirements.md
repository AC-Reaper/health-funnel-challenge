# 01 — Requirements

> **Purpose.** The testable functional + non-functional spec the
> implementation will be measured against. Each requirement has an id
> (`R-NNN`) so reviews and tests can reference it.
>
> **Owner.** Claude. Filled by Codex on 2026-05-20 from
> `PROJECT_BRIEF.md`, `docs/00-product-research.md`, and the shipped
> API/architecture docs.
>
> **Status.** Current for the submitted MVP. If this file conflicts with
> `PROJECT_BRIEF.md`, the brief wins until an ADR amends it.

## 1. Functional requirements

| ID | Requirement | Source | Acceptance test |
| - | - | - | - |
| R-001 | The system shall create or reuse an anonymous session for each visitor using a signed httpOnly cookie. | Brief §三.1; ADR-004 | `POST /api/v1/sessions` returns the canonical session DTO and sets `hfc_session`; `GET /api/v1/sessions/me` with that cookie returns the same session; no valid cookie returns `401 NO_SESSION`. |
| R-002 | The system shall expose a 6-step funnel: `gender`, `main_goal`, `age`, `height`, `weight`, `activity`. | Brief §三.1; Research §5 | Walking the browser funnel or cURL flow can save all six steps in order and reaches a submittable assessment. |
| R-003 | The system shall persist each completed step immediately, before final submit. | Brief §三.1; Research §3 | After PATCH-ing a step, `GET /api/v1/sessions/me` includes the saved answer even if the page is refreshed or the browser route is reopened. |
| R-004 | The system shall compute progress server-side as the first incomplete required step. | ADR-008; Architecture §2 | Saving `gender`, `main_goal`, and `age`, then refreshing, returns `currentStep = "height"`; trying to save `activity` first returns `409 STEP_OUT_OF_ORDER` with `fields.firstMissingStep`. |
| R-005 | The system shall validate every step body with strict schemas and reject invalid, extra, or incoherent values. | Brief §六; ADR-005 | Boundary tests cover age/height/weight ranges, unknown fields, inherited step keys, and `mainGoal` x `targetWeightKg` coherence; invalid input returns `422 VALIDATION_ERROR` with field keys. |
| R-006 | The system shall prevent answer edits after submit for the MVP. | API §3; Architecture §2 | PATCH-ing any step after `POST /api/v1/sessions/me/submit` returns `409 ALREADY_SUBMITTED`. |
| R-007 | The system shall submit only complete and coherent assessments. | Brief §三.2; API §4 | Missing answers return `422 INCOMPLETE_ASSESSMENT`; stored incoherent answers return `422 VALIDATION_ERROR`; a complete valid assessment creates a result snapshot. |
| R-008 | The system shall compute BMI, BMI category, daily calorie target, predicted target date, weekly curve points, and algorithm version on the server. | Brief §三.2; Architecture §4 | Calculator fixture tests assert deterministic output for representative and boundary inputs; client-supplied result fields are never accepted. |
| R-009 | The system shall persist computed results as immutable snapshots linked to the session. | Brief §三.2; DB §3 | Replaying submit returns the existing `resultId` and does not recompute or insert a second result row. |
| R-010 | The system shall reject result reads before submit. | API §5 | `GET /api/v1/results/me` before submit returns `409 NOT_SUBMITTED`. |
| R-011 | The system shall return a teaser result to free sessions and a full result to paid sessions. | Brief §三.3; Research §4 | Before payment, `GET /api/v1/results/me` returns `kind = "teaser"` with BMI/category/headline only; after payment it returns `kind = "full"` with calories/date/curve/plan/version. |
| R-012 | The system shall guarantee that teaser responses cannot leak paid-only fields. | Brief §三.3; Research §4 | A leak test JSON-serializes the teaser and asserts `dailyCaloriesKcal`, `predictedTargetDate`, `curvePoints`, `plan`, and `algorithmVersion` are absent. |
| R-013 | The system shall provide a browser `/pay` route that lets a submitted free user trigger mock payment. | Brief §三.3; API §6 | Visiting `/pay` without a session redirects to `/`; visiting after submit renders the mock payment CTA and redirects to `/results` after successful pay. |
| R-014 | The system shall expose `POST /api/v1/pay` as the mock payment endpoint and grant paid entitlement in one transaction. | Brief §三.3; ADR-006 | A valid pay call inserts one payment row, sets `session.entitlement_status = "paid"`, sets `paid_at`, and makes the next result read return full data. |
| R-015 | The system shall make payment replay-safe with `Idempotency-Key`. | ADR-006; ADR-012 | Reusing the same key returns the same payment; using a new key after paid returns `200` without inserting a second payment row. |
| R-016 | The system shall expose a public liveness endpoint. | Brief §四; API §8 | `GET /api/v1/healthz` returns `200` with `{ status: "ok", version, ts }` without requiring a cookie. |
| R-017 | The system shall ship a reproducible live demo path. | Brief §五.1 | README cookie-jar cURL flow creates a session, saves six steps, submits, reads teaser, pays, and reads full result against the public URL. |
| R-018 | The system shall record every successful step write in an append-only audit table. | ADR-009 | Each successful PATCH writes a matching `step_event` row inside the same transaction as the assessment update. |

## 2. Non-functional requirements

| ID | Requirement | Source | Acceptance test |
| - | - | - | - |
| R-101 | All `/api/v1` request and response contracts shall be documented and typed. | Brief §六; API §Overview | `docs/04-api-design.md` lists every route, schema, response, and error code; route handlers return typed DTOs. |
| R-102 | All JSON endpoints shall use a consistent error envelope and HTTP status semantics. | API §Error model | Validation, auth, conflict, payload-size, and internal errors return `{ error: { code, message, requestId, fields? } }` and never return `200` for failures. |
| R-103 | State-changing routes shall run same-origin checks before mutating session data. | Security hardening; API §Authentication | Cross-origin `Origin` headers on POST/PATCH routes return `403 FORBIDDEN_ORIGIN`; cURL/no-origin requests still work for the demo. |
| R-104 | Personalised API responses shall not be cached by shared caches. | Security hardening | Every `/api/v1` response except `/healthz`, including errors, has `Cache-Control: private, no-store, max-age=0`. |
| R-105 | Request bodies shall be bounded to prevent oversized payloads. | Security hardening | Bodies larger than 16 KB by byte length return `413 PAYLOAD_TOO_LARGE`; legitimate funnel bodies stay below the cap. |
| R-106 | Session cookies shall be tamper-resistant and time-limited server-side. | ADR-004; ADR-014 | `verifyCookie` rejects malformed payloads, wrong signatures, swapped `sid`, tampered `iat`, future `iat`, and expired cookies. |
| R-107 | The MVP shall be single-device by design. | Brief §7; ADR-004 | Resume works only when the same browser/cookie jar sends `hfc_session`; a bare `sessionId` without cookie returns `401 NO_SESSION`. |
| R-108 | The calculator shall be deterministic and versioned. | ADR-013; Architecture §4 | The same assessment always produces the same result for a given `algorithmVersion`; formula changes require a version bump. |
| R-109 | Database invariants shall backstop critical business rules. | DB §5 | Unique constraints enforce one result per session and same-key payment idempotency; a partial unique index prevents two succeeded payments for one session. |
| R-110 | The deployed demo shall run on managed free-tier infrastructure with no operators required. | Brief §四; ADR-003 | Vercel hosts the app, Supabase hosts Postgres, migrations are checked in, and README setup/deploy instructions are sufficient to reproduce. |
| R-111 | The system shall remain observable enough for an interview demo. | Project Brief §4 | Request IDs are included in errors/logs, `/healthz` gives liveness, and README cURL steps expose each lifecycle transition. |
| R-112 | The implementation shall keep health data private within the app boundary. | Research §5; Security hardening | No third-party data transmission is part of the MVP; signed cookies, no-store headers, and server-side gating protect personalised result data. |

## 3. User stories

### Discovery

- As a visitor, I want to understand this is a short health quiz so I am
  willing to start.
- As an evaluator, I want the landing page and README to make the demo
  path obvious so I can test the loop quickly.

### Funnel

- As a visitor, I want each answer to save as I go so I do not lose
  progress on refresh.
- As a visitor, I want the quiz to resume at the next unanswered step so
  I can continue without re-entering everything.
- As a system, I want to reject skipped or invalid steps so the stored
  assessment is always computable.

### Submit and Result

- As a visitor, I want a result summary after completing the quiz so the
  app feels responsive before payment.
- As a system, I want the result computed once and stored so refreshes
  and submit replays remain stable.
- As an evaluator, I want the free and paid responses to be visibly and
  programmatically different.

### Paywall

- As a free visitor, I want to see what is locked so the payment CTA has
  context.
- As a system, I want paid-only data protected by the API, not just by
  blurred UI.
- As an evaluator, I want `/pay` to be easy to replay without creating
  duplicate payments.

### Post-pay

- As a paid visitor, I want the full plan available after refresh.
- As an evaluator, I want a cURL path that proves teaser -> pay -> full
  result without using browser-only state manually.

## 4. Acceptance criteria summary

| Requirement group | Acceptance criteria |
| - | - |
| Session and resume | R-001 through R-004 pass via browser smoke, cookie-jar cURL, and progress/session tests. |
| Validation and submission | R-005 through R-010 pass via Zod schema tests, route tests or live smoke, and result-repo idempotency tests. |
| Gating and payment | R-011 through R-015 pass via serializer leak tests, payment state-machine tests, DB constraints, and README cURL proof. |
| Delivery | R-016 and R-017 pass against the public Vercel URL and documented setup/demo commands. |
| Audit | R-018 passes via transaction tests that assert `step_event` and assessment updates are written together. |
| Security and reliability | R-101 through R-112 pass via API docs, hardening tests, Prisma schema/migration checks, and documented non-goals. |

The canonical project-level Definition of Done remains
`PROJECT_BRIEF.md` §6. This section maps that DoD to requirement IDs so
future reviews can point to stable targets.

## 5. Out of scope

The following are intentionally out of MVP scope. See
`docs/02-architecture.md` §9 for rationale and ADR links.

- Real auth: email, OAuth, magic links, accounts, password reset.
- Real payment provider, webhooks, refunds, invoices, or recurring
  subscription lifecycle.
- Cross-device resume or a raw paid `sessionId` that works without the
  signed cookie.
- Email capture, notifications, CRM, or marketing automation.
- ML-generated health plans or opaque recommendation engines.
- Admin dashboard, analytics dashboards, A/B testing UI, or growth
  experimentation.
- Production-grade rate limiting, Sentry/APM, strict CSP nonce plumbing,
  or full privacy/compliance program.
- GraphQL/tRPC, mobile apps, i18n, or pixel-perfect BetterMe UI clone.
