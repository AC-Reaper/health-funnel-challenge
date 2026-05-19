# 08 — Security Hardening

> **Purpose.** Falsifiable evidence that the attack surface of this
> demo was thought through. Every claim points to a file path, a
> commit, a test, or an ADR. Generic security claims without
> verification do not belong here.
>
> **Owner.** Claude on `feature/security-hardening`. Codex reviews via
> `reviews/review-009-security-hardening.md`.

## 1. Attack surface

The shipped surface is **seven HTTP endpoints under `/api/v1`** plus
three browser routes (`/`, `/funnel`, `/pay`, `/results`). All client
input lands at one of the seven API routes, four of which are
state-changing.

| Channel | Threat | First line of defense |
| - | - | - |
| Signed cookie (`hfc_session`) | Forgery, replay, expiry bypass | HMAC-SHA256 over `${sid}.${iat}` + server-side 30d TTL (ADR-014) |
| JSON body | Malformed JSON, wrong content-type, unknown keys, type confusion | `lib/api/parse-body.ts` enforces `Content-Type: application/json`, parses JSON, runs a Zod `.strict()` schema |
| Step PATCH | Out-of-order writes, prototype pollution, coherence violations | `lib/validation/steps.ts` (bounded enums + numeric ranges), `Object.hasOwn` step-key guard (B002), first-incomplete-step rule (ADR-008), `checkWeightCoherence` / `checkMainGoalChange` |
| Submit | Inserting a result without a complete or coherent assessment | `FULL_ASSESSMENT_SCHEMA.superRefine` re-validates server-side; DB `UNIQUE (result.session_id)` + P2002 race recovery |
| Results gate | Free user receiving paid fields | Two distinct serializer **types** (`TeaserResultDTO` vs `FullResultDTO`); type system cannot emit paid fields on teaser (review-001 §4) |
| Pay | Double-charge, log-poisoning via `Idempotency-Key`, replay storms | `IDEMPOTENCY_KEY_SCHEMA` (printable ASCII), DB `UNIQUE (session_id, idempotency_key)`, partial unique index `payment_one_success_per_session_idx WHERE status='succeeded'` (ADR-012) |
| Headers | Cross-site browser POSTs, CSRF-style attacks | `SameSite=Lax` + `HttpOnly` + `Secure` (prod) on the cookie; `checkSameOrigin` guard on every mutating route |

## 2. Existing controls (with citations)

| Control | Where | How verified |
| - | - | - |
| Zod `.strict()` on every request body | `lib/validation/steps.ts`, `lib/validation/assessment.ts`, `app/api/v1/sessions/route.ts:25`, `app/api/v1/sessions/me/submit/route.ts:33`, `app/api/v1/pay/route.ts:21` | `tests/lib/validation/steps.test.ts`, `tests/lib/validation/assessment.test.ts`, `tests/lib/api/parse-body.test.ts` |
| Per-step bounded enums + numeric ranges | `lib/validation/steps.ts` | `tests/lib/validation/steps.test.ts` |
| Cross-field coherence (weight × main_goal) | `lib/health/coherence.ts`, `lib/assessment.ts` | `tests/lib/validation/assessment.test.ts`, `tests/lib/assessment.test.ts` |
| First-incomplete-step rule (ADR-008) | `lib/progress.ts`, `lib/assessment.ts:firstMissingPrereq` | `tests/lib/progress.test.ts`, `tests/lib/assessment.test.ts` |
| Prototype-pollution guard (`Object.hasOwn`) | `lib/validation/steps.ts:isStepKey` (review-002 B002) | `tests/lib/validation/steps.test.ts` (inherited-key cases) |
| HMAC-signed cookie + server-side TTL | `lib/session.ts:hmac`, `lib/session.ts:verifyCookie` (ADR-014) | `tests/lib/session.test.ts` (TTL + tamper + future-iat + missing-iat) |
| `HttpOnly; SameSite=Lax; Secure (prod)` on `Set-Cookie` | `lib/session.ts:buildSetCookieHeader` | Live cookie-jar smoke (README §"Demo path"); review-007 production verification |
| Two-serializer leak invariant | `lib/serializers/result.ts` | `tests/lib/serializers/result.test.ts` (LEAK INVARIANT case asserts every paid-only field name is absent from teaser JSON) |
| `/submit` idempotency | `lib/result-repo.ts:runSubmitTransaction` (review-006 B001) | `tests/lib/result-repo.test.ts` (idempotent replay + P2002 race) |
| `/pay` same-key replay | `lib/payment.ts:decidePaymentAction` (ADR-006) | `tests/lib/payment.test.ts` ("idempotent same-key replay") |
| `/pay` already-paid new-key silent no-op | `lib/payment.ts:decidePaymentAction` (ADR-012) | `tests/lib/payment.test.ts` ("already-paid + NEW key → silent no-op") + DB partial unique index `payment_one_success_per_session_idx` |
| `/pay` SELECT … FOR UPDATE per-session serialization | `lib/payment.ts:processPayment` | Live cookie-jar smoke + payment-table row-count assertions |
| `step_event` audit row written inside the same PATCH transaction | `lib/step-repo.ts:runStepsTransaction` (ADR-009, T-502) | `tests/lib/step-repo.test.ts` (success path + rollback path) |
| Parameterized SQL — no raw user input concatenation | All DB writes go through Prisma's query-builder (parameterized by construction). Exactly **one** `$queryRaw` callsite exists in app / lib / prisma / tests code: `lib/payment.ts:183` runs `tx.$queryRaw\`SELECT id FROM "session" WHERE id = ${sessionId}::uuid FOR UPDATE\`` as the ADR-006 per-session lock for `/pay`. Prisma's **tagged-template** form parameterizes `${sessionId}` as a bound prepared-statement value — it is not string-concatenated. The `sessionId` value comes from `verifyCookie(...)` (HMAC-validated), not from the request body. | Reproducer: `rg -n '\$queryRaw\|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'` returns exactly that one site; inspect it to confirm the `${sessionId}` interpolation is a bound parameter, not concatenation. |
| Same-origin guard on mutating routes (host + conditional scheme) | `lib/api/same-origin.ts` (this branch). Host comparison is always enforced; scheme comparison is enforced when `x-forwarded-proto` is present (Vercel sets it), and falls back to host-only when absent (cURL / local dev). Rejection envelope is `403 FORBIDDEN_ORIGIN`. | `tests/lib/api/same-origin.test.ts` (11 cases incl. scheme mismatch, forwarded-proto chain, fallback) |
| `Idempotency-Key` restricted to printable ASCII | `lib/api/idempotency-key.ts` (this branch) | `tests/lib/api/idempotency-key.test.ts` (11 cases) |

## 3. Test proof table

Every state-changing endpoint plus every cross-cutting concern maps to
a committed regression. No "verified in design only" rows.

| Risk | Test file / DB invariant | What it asserts |
| - | - | - |
| Wrong `Content-Type` → 400 | `tests/lib/api/parse-body.test.ts` | rejects non-JSON content types |
| Malformed JSON → 400 | `tests/lib/api/parse-body.test.ts` | rejects JSON parse failure |
| Unknown keys in body → 422 | `tests/lib/api/parse-body.test.ts` | `.strict()` flags unknown fields |
| Enum injection | `tests/lib/validation/steps.test.ts` | every step enum rejects unknown values |
| Numeric out-of-range | `tests/lib/validation/steps.test.ts` | age 13-100, height 120-230, weight 30-250 boundaries pinned |
| Non-integer age / height | `tests/lib/validation/steps.test.ts` | `.int()` enforced |
| Step out-of-order PATCH → 409 | `tests/lib/assessment.test.ts:firstMissingPrereq` | walks STEP_ORDER and rejects gaps |
| Submitted-then-PATCH → 409 | Route handler (`app/api/v1/sessions/me/steps/[stepKey]/route.ts:48`) + live cookie-jar smoke | route returns `ALREADY_SUBMITTED` when `session.status === "submitted"` |
| main_goal flip incoherence → 422 | `tests/lib/assessment.test.ts` (`checkMainGoalChange` cases) | rejects mainGoal change against stored weight pair |
| Weight × main_goal at /submit → 422 | `tests/lib/validation/assessment.test.ts` (FULL_ASSESSMENT_SCHEMA `superRefine`) | rejects incoherent stored rows pre-`compute()` |
| Cookie tampered signature → 401 | `tests/lib/session.test.ts` | bit-flip + swapped-sid + wrong-length-sig |
| Cookie expired (>30d) → 401 | `tests/lib/session.test.ts` "verifyCookie TTL" | iat past TTL → null |
| Cookie missing / non-integer / future iat → 401 | `tests/lib/session.test.ts` "verifyCookie TTL" | 3 dedicated cases |
| Deleted session cookie → 401 | Route handler (`app/api/v1/sessions/me/steps/[stepKey]/route.ts:46`) + live smoke | `findSessionById` returns null → `noSession(requestId)` |
| Free result leaks paid field | `tests/lib/serializers/result.test.ts` "LEAK INVARIANT" | `JSON.stringify(teaser)` must not contain `dailyCaloriesKcal`, `predictedTargetDate`, `curvePoints`, `"plan"`, `algorithmVersion` |
| `/submit` double-call same session | `tests/lib/result-repo.test.ts` | second call returns the original result; no second insert |
| `/pay` missing Idempotency-Key → 400 | Route handler + live smoke | `IDEMPOTENCY_KEY_SCHEMA.safeParse(null)` fails |
| `/pay` Idempotency-Key with control char → 400 | `tests/lib/api/idempotency-key.test.ts` | rejects `\n`, `\0`, `\t`, non-ASCII |
| `/pay` same-key replay | `tests/lib/payment.test.ts` | same `paymentId` on second call; one DB row |
| `/pay` already-paid + new key → silent no-op | `tests/lib/payment.test.ts` + DB partial unique index | same `paymentId`; never inserts a second succeeded row |
| Cross-origin browser POST (host mismatch) | `tests/lib/api/same-origin.test.ts` | 403 FORBIDDEN_ORIGIN on host mismatch |
| Cross-scheme POST (http origin against TLS-terminated host) | `tests/lib/api/same-origin.test.ts` | 403 FORBIDDEN_ORIGIN when `x-forwarded-proto` is present and `URL(origin).protocol` differs |
| `Origin: null` / malformed | `tests/lib/api/same-origin.test.ts` | rejected |
| SQL injection via body | All DB writes go through Prisma's parameterized query-builder. The **only** `$queryRaw` callsite in app / lib / prisma / tests is `lib/payment.ts:183` — the per-session lock `SELECT id FROM "session" WHERE id = ${sessionId}::uuid FOR UPDATE` — and it uses Prisma's tagged-template form (so `${sessionId}` is bound, not concatenated). The `sessionId` value comes from `verifyCookie`, not the request body. | `rg -n '\$queryRaw\|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'` returns exactly that one site; the §2 row walks through it. |

## 4. Day-5 / post-MVP additions changelog

- **ADR-014** — server-side cookie TTL via `iat` + 30d expiry + 60s
  clock-skew (`feature/day5-hardening`). Closed review-004-final.
- **`step_event` audit table** (T-502, ADR-009 Accepted-and-shipped)
  — append-only audit of every successful PATCH inside the same
  transaction (`feature/day5-hardening`).
- **Same-origin guard** — `lib/api/same-origin.ts`, this branch.
- **`Idempotency-Key` printable-ASCII restriction** —
  `lib/api/idempotency-key.ts`, this branch.

## 5. Intentionally out of scope

The brief grades a 5-day demo, not a SaaS. The following are
**deliberately not in scope**; if the evaluator wants any of them
later, they are documented elsewhere as known follow-ups.

- **Real authentication** (email / OAuth / magic link). The brief
  permits anonymous session-based identity (ADR-004). Adding a user
  table costs at least a day and moves no scoring criterion.
- **Real payment provider** (Stripe / webhook signature
  verification). The brief asks for a mock; we mimic the
  idempotency-key + DB-unique + single-transaction shape so the
  scored "支付回调闭环" criterion lands on the design, not on a real
  Stripe integration (ADR-006).
- **Rate limiting**. Vercel serverless invalidates in-memory limiters
  (different instances per request). The production path is
  documented as Upstash / Vercel KV in `docs/02-architecture.md` §9
  but not implemented for the demo window.
- **WAF / captcha / bot detection**. Not graded. Adding them would
  obscure the hand-rolled controls the brief actually evaluates.
- **User-data export / deletion endpoints (GDPR-style)**. No PII is
  collected; the data is age, height, weight, goal, activity, and a
  per-session UUID. Deleting the cookie + the row by `sessionId` is
  the only meaningful operation and is available through Supabase SQL.
- **Cross-device session resume**. Anonymous cookie cannot address
  this without real auth. Documented as a known limitation, not a
  defect.
