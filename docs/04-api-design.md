# API Design

> Status: **Current** — Claude 2026-05-18, last updated 2026-05-19
> against `feature/day5-hardening` after review-004-final I002. Mirrors
> `docs/02-architecture.md` v2 + ADR-001…014. The seven routes below
> are all implemented, smoked, and reviewed; review-001/002/003/006/007
> are Resolved. The auth section reflects ADR-014's server-side cookie
> TTL.

## Overview

- All JSON endpoints live under `/api/v1`. The version is in the path so a
  future v2 can coexist.
- One browser route exists outside `/api/v1`: `GET /pay` (mock payment page).
- Content type is always `application/json; charset=utf-8` for requests and
  responses. No multipart, no form-url-encoded.
- Times are ISO-8601 UTC strings (`2026-05-18T09:30:00.000Z`). Dates are
  `YYYY-MM-DD`. Money is integer `amount_cents` + ISO-4217 `currency`.
- Field naming: response keys are `snake_case` in the DB but **`camelCase`
  on the wire** to match TypeScript/JS conventions in the client.
- The server is the only source of truth for `current_step`,
  `entitlement_status`, and result values. Never trust them from the client.

## Authentication

- Identity = anonymous session, carried by a **signed httpOnly cookie**
  named `hfc_session`.
- The cookie is set by `POST /api/v1/sessions`. Its base64url-encoded
  payload is `{ sid: <uuid>, iat: <unix-seconds>, sig: <hex> }` where
  `sig = HMAC-SHA256(\`${sid}.${iat}\`, SESSION_COOKIE_SECRET)` — both
  `sid` and `iat` are covered by the signature so neither can be
  tampered without invalidating it.
- Set-Cookie flags: `HttpOnly`, `Secure` (prod), `SameSite=Lax`,
  `Path=/`, `Max-Age = 60 * 60 * 24 * 30` (30 days).
- **Server-side TTL** (ADR-014, T-501): in addition to the client
  `Max-Age`, `verifyCookie` enforces server-side that
  `now - iat < 30 days` with a 60-second clock-skew tolerance. A
  captured cookie value cannot be replayed past TTL. `verifyCookie`
  returns `null` (which routes translate to `401 NO_SESSION`) for any
  of: missing/garbled base64url, malformed JSON, missing `sid`/`iat`/
  `sig`, non-integer `iat`, future-dated `iat` (forged), expired
  `iat`, wrong-length `sig`, or `timingSafeEqual` HMAC mismatch.
- Every gated route handler calls
  `verifyCookie(cookies().get(COOKIE_NAME)?.value)` (defined in
  `lib/session.ts`). If it returns `null`, the route returns `401
  NO_SESSION` using the standard error envelope. A cookie that signs
  cleanly but points to a deleted session id also returns `401
  NO_SESSION` (treat as missing; do not auto-create).
- No `Authorization` header. No CSRF tokens needed because all state-changing
  endpoints require the signed httpOnly cookie that browsers don't expose to
  JS, **and** SameSite=Lax blocks cross-site POSTs. Same-origin only for the
  demo.
- **Same-origin guard** (`lib/api/same-origin.ts`): every mutating route
  (POST /sessions, PATCH /steps/:stepKey, POST /submit, POST /pay) runs
  `checkSameOrigin` before any cookie read. If the request carries an
  `Origin` header, both its **host** and its **scheme** are compared
  to the receiving end: host vs `x-forwarded-host ?? host`,
  case-insensitive; scheme vs `x-forwarded-proto` when present (the
  left-most entry of the comma-separated chain). When
  `x-forwarded-proto` is absent (cURL, local dev), the scheme check
  falls back to host-only. Mismatch returns `403 FORBIDDEN_ORIGIN`.
  Requests with no `Origin` pass through — this carve-out keeps the
  README cookie-jar walkthrough and server-internal Node fetch
  working. See `docs/08-security-hardening.md` §2.

## Versioning

- URL path: `/api/v1/...`. Breaking changes go to `/api/v2/...`.
- `algorithm_version` (in `result`) and `Date` semantics are independent of
  API version.

## Error model

All errors share one envelope, regardless of status code:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ageYears must be between 13 and 100",
    "fields": {
      "ageYears": "must be between 13 and 100"
    },
    "requestId": "req_01HXY…"
  }
}
```

- `code` is a stable machine-readable string from the table below.
- `fields` is present only on `VALIDATION_ERROR`. Keys are camelCase request
  fields.
- `requestId` is echoed from / generated for every request for log
  correlation.
- HTTP status follows HTTP semantics, never `200` with an error body.

| HTTP | `code` | When |
| - | - | - |
| 400 | `BAD_REQUEST` | Malformed JSON, missing required header, unknown step key. |
| 401 | `NO_SESSION` | Missing / bad-signature / expired cookie, or cookie points to a deleted session. |
| 403 | `FORBIDDEN_ORIGIN` | `Origin` header present and does not match the receiving host. Sent only when `Origin` is set (cURL / server-internal fetch are unaffected). See `docs/08-security-hardening.md` §2. |
| 404 | `NOT_FOUND` | Resource id is well-formed but does not exist. |
| 409 | `STEP_OUT_OF_ORDER` | Step save would skip a required earlier step. |
| 409 | `NOT_SUBMITTED` | Result or payment requested before `/submit`. Used by both `GET /api/v1/results/me` and `POST /api/v1/pay`. |
| 409 | `ALREADY_SUBMITTED` | `/submit` called again with different inputs (we still return 200 with the existing result for identical replays — see `/submit`). |
| 422 | `VALIDATION_ERROR` | Zod validation failed on body or step. |
| 422 | `INCOMPLETE_ASSESSMENT` | `/submit` called while required answers are missing. |
| 429 | `RATE_LIMITED` | Reserved; not enforced in the MVP. |
| 500 | `INTERNAL_ERROR` | Unhandled server failure. Logged with `requestId`. |

---

## Endpoint catalogue

### 1. Create or reuse session

`POST /api/v1/sessions`

- **Auth**: none.
- **Body**: `{}` (empty). Validated by `z.object({}).strict()`; any
  unknown field is rejected with `422 VALIDATION_ERROR`. Wrong
  `Content-Type` or malformed JSON returns `400 BAD_REQUEST`.
- **Behaviour**:
  - If a valid `hfc_session` cookie is present and points to an existing
    session, return that session and reuse the cookie.
  - Otherwise create a new `session` row, set the cookie, return the session.
- **200 OK** — Canonical session DTO (same shape as §2):
  ```json
  {
    "sessionId": "1a2b…",
    "status": "draft",
    "currentStep": "gender",
    "entitlementStatus": "free",
    "submitted": false,
    "createdAt": "2026-05-18T09:30:00.000Z",
    "answers": {}
  }
  ```
  `answers` is always present, even for a freshly created session (in
  which case it is `{}`). Null fields inside `answers` are omitted.
- **Headers set**: `Set-Cookie: hfc_session=…; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`.

---

### 2. Resume

`GET /api/v1/sessions/me`

- **Auth**: cookie required.
- **Behaviour**: returns the current funnel state. `currentStep` is
  recomputed server-side as the first incomplete required step. `answers`
  contains only the steps the user has saved (omits null fields).
- **200 OK** — Same canonical session DTO as §1, with `answers`
  populated according to saved steps:
  ```json
  {
    "sessionId": "1a2b…",
    "status": "draft",
    "currentStep": "weight",
    "entitlementStatus": "free",
    "submitted": false,
    "createdAt": "2026-05-18T09:30:00.000Z",
    "answers": {
      "gender": "female",
      "mainGoal": "lose_weight",
      "ageYears": 29,
      "heightCm": 168
    }
  }
  ```
- **401 NO_SESSION** if no valid cookie.

---

### 3. Save one step

`PATCH /api/v1/sessions/me/steps/:stepKey`

- **Auth**: cookie required.
- **Path param**: `stepKey ∈ { gender, main_goal, age, height, weight, activity }`.
  - `weight` saves both `weightKg` and `targetWeightKg` together because
    the calculator's plausibility check couples them.
- **Body** (varies per step, all numbers are server-bounded):

  | stepKey | body |
  | - | - |
  | `gender` | `{ "gender": "female" \| "male" }` |
  | `main_goal` | `{ "mainGoal": "lose_weight" \| "maintain" \| "gain_weight" \| "build_muscle" }` |
  | `age` | `{ "ageYears": int 13..100 }` |
  | `height` | `{ "heightCm": int 120..230 }` |
  | `weight` | `{ "weightKg": number 30..250, "targetWeightKg": number 30..250 }` |
  | `activity` | `{ "activityLevel": "sedentary" \| "light" \| "moderate" \| "active" \| "very_active" }` |

- **Behaviour**:
  - Zod-validate only this step's fields.
  - **First-incomplete-step rule**: if saving this step would require a
    not-yet-saved earlier step (e.g. saving `activity` before `age`), respond
    `409 STEP_OUT_OF_ORDER` and include `firstMissingStep` in `fields`.
  - Editing a step that has already been saved is allowed (idempotent
    upsert).
  - Every successful PATCH also writes a `step_event` audit row
    (ADR-009, T-502) inside the same transaction, capturing the
    validated body verbatim.
  - Cross-field check (weight × main_goal): if `mainGoal` is
    `lose_weight` then `targetWeightKg < weightKg`; if `gain_weight`
    then `>`; if `maintain` then within ±2kg. Violations →
    `VALIDATION_ERROR` with both `weightKg` and `targetWeightKg` fields.
    The same rule is enforced **symmetrically** when PATCH-ing
    `main_goal` against an already-saved weight pair — in that case
    the violation surfaces on `mainGoal` and `targetWeightKg`
    (review-002 I005). `build_muscle` is intentionally unconstrained
    (review-002 N004); see §3 closing note.
- **200 OK** — Canonical session DTO (same shape as §1 and §2):
  ```json
  {
    "sessionId": "1a2b…",
    "status": "draft",
    "currentStep": "age",
    "entitlementStatus": "free",
    "submitted": false,
    "createdAt": "2026-05-18T09:30:00.000Z",
    "answers": { "gender": "female", "mainGoal": "lose_weight" }
  }
  ```
- **400 BAD_REQUEST** if `:stepKey` is not one of the six known step
  keys, or if the request is wrong-`Content-Type` / malformed JSON.
- **409 ALREADY_SUBMITTED** if the session has already been submitted;
  answers are immutable after `/submit`.
- **409 STEP_OUT_OF_ORDER**
  ```json
  {
    "error": {
      "code": "STEP_OUT_OF_ORDER",
      "message": "Cannot save 'activity' before 'age'.",
      "fields": { "firstMissingStep": "age" }
    }
  }
  ```
- **422 VALIDATION_ERROR** for bad values, including the
  weight × main_goal coherence violation, which returns messages on
  both `weightKg` and `targetWeightKg`.

> **Note (build_muscle semantics, review-002 N004).** The cross-field
> rule does **not** constrain `build_muscle` in either direction.
> This is intentional — recomposition users may keep
> `targetWeightKg ≈ weightKg` (losing fat while gaining muscle), gain
> mass (`targetWeightKg > weightKg`), or even cut to a leaner physique
> (`targetWeightKg < weightKg`). If a future product decision tightens
> this, the change goes through an ADR and a new test in
> `tests/lib/assessment.test.ts`.

---

### 4. Submit

`POST /api/v1/sessions/me/submit`

- **Auth**: cookie required.
- **Body**: `{}`.
- **Behaviour**:
  - Re-validate the entire `assessment` (Zod schema for the full answer set).
  - Run `lib/health/calculator.ts` server-side; write `result` row;
    mark `session.status = 'submitted'`, `submitted_at = now()`.
  - **Idempotent**: if a `result` already exists for this session, return it
    unchanged (200). The assessment fields used to compute it are never
    recomputed even if the user later edits a step. (Editing after submit is
    out of MVP scope; a future iteration could invalidate and recompute.)
- **200 OK**
  ```json
  {
    "sessionId": "1a2b…",
    "submittedAt": "2026-05-18T09:35:12.000Z",
    "resultId": "9f8e…",
    "entitlementStatus": "free"
  }
  ```
- **422 INCOMPLETE_ASSESSMENT** if any required field is missing, with
  `fields.missingSteps: ["weight","activity"]`.
- **422 VALIDATION_ERROR** if the stored assessment is internally
  incoherent (review-006 I001). `/submit` re-runs the weight × main_goal
  coherence rule via `FULL_ASSESSMENT_SCHEMA.superRefine()`, so a row
  inserted through any non-step path (manual DB edit, future
  regression) cannot reach `compute()`. Field messages land on
  `mainGoal`, `weightKg`, and `targetWeightKg`.

---

### 5. Get gated result

`GET /api/v1/results/me`

- **Auth**: cookie required.
- **Behaviour**: branches on `session.entitlement_status`. Two distinct
  serializers in `lib/serializers/result.ts`. The teaser type cannot emit
  paid-only fields.

- **200 OK — teaser** (`entitlement_status = 'free'`)
  ```json
  {
    "kind": "teaser",
    "result": {
      "bmi": 22.4,
      "bmiCategory": "normal",
      "headline": "Your starting point looks healthy — unlock your full plan."
    },
    "paywall": {
      "priceCents": 999,
      "currency": "USD",
      "ctaHref": "/pay"
    }
  }
  ```

- **200 OK — full** (`entitlement_status = 'paid'`)
  ```json
  {
    "kind": "full",
    "result": {
      "bmi": 22.4,
      "bmiCategory": "normal",
      "dailyCaloriesKcal": 1850,
      "predictedTargetDate": "2026-08-12",
      "curvePoints": [
        { "week": 0,  "weightKg": 68.0 },
        { "week": 1,  "weightKg": 67.5 },
        { "week": 12, "weightKg": 62.0 }
      ],
      "plan": {
        "summary": "Sustainable 0.5kg/week deficit.",
        "note": null
      },
      "algorithmVersion": "v1.0.0-mifflin"
    }
  }
  ```

- **409 NOT_SUBMITTED** if `/submit` has not been called.
- **Test invariant**: a snapshot test JSON-serialises a teaser response and
  asserts the strings `dailyCaloriesKcal`, `predictedTargetDate`,
  `curvePoints`, `"plan"`, and `algorithmVersion` are **not** present.

---

### 6. Mock payment (browser route)

`GET /pay`

- **Auth**: cookie required (redirect to `/` if missing).
- **Behaviour**: renders a minimal payment form (one CTA button "Pay
  $9.99"). On submit, the page calls `POST /api/v1/pay` with a freshly
  generated `Idempotency-Key` and on success redirects to `/results`.
- Not part of `/api/v1`. The challenge brief asks for `/pay` by name; this
  is that page.

---

### 7. Mock payment (API)

`POST /api/v1/pay`

- **Auth**: cookie required.
- **Required header**: `Idempotency-Key: <1-128 printable-ASCII chars>`.
  - Schema: `lib/api/idempotency-key.ts` enforces `[\x20-\x7E]+`,
    length 1-128. UUID v4, base64, hex, and short human-readable keys
    all fit. Control characters, embedded newlines, and any non-ASCII
    Unicode are rejected (log-poisoning vector + DB column is
    `VARCHAR(128)` per ADR-006). See `docs/08-security-hardening.md` §2.
  - Missing, empty, > 128 chars, or containing non-printable / non-ASCII
    characters → `400 BAD_REQUEST`.
- **Body**: `{}`. `amountCents`, `currency` are server constants and are
  rejected if provided.
- **Behaviour** (single transaction):
  1. `SELECT` the session row for update.
  2. If `session.entitlement_status = 'paid'` and this
     `Idempotency-Key` already has a `payment` row, return that existing
     row (same-key replay).
  3. If `session.entitlement_status = 'paid'` and this key is new, return
     the existing paid entitlement as a no-op and do not insert a new
     `payment` row.
  4. Otherwise, `INSERT INTO payment (session_id, idempotency_key, status, amount_cents, currency) VALUES (...) ON CONFLICT (session_id, idempotency_key) DO NOTHING`.
  5. If no row inserted, `SELECT` the existing one (same-key idempotent replay).
  6. `UPDATE session SET entitlement_status='paid', paid_at=now() WHERE id=$1`.
  7. Commit.
- **Replay semantics**:
  - Same `Idempotency-Key` again → returns the original `payment` payload
    unchanged. `entitlementStatus` is still `paid`.
  - Different `Idempotency-Key` against an already-paid session → `200 OK`
    with the existing paid entitlement. No second `payment` row is inserted.
- **200 OK**
  ```json
  {
    "paymentId": "f0b8c2e4-7d3a-4d5e-9c8b-1a2b3c4d5e6f",
    "sessionId": "1a2b…",
    "status": "succeeded",
    "amountCents": 999,
    "currency": "USD",
    "entitlementStatus": "paid",
    "paidAt": "2026-05-18T09:37:00.000Z"
  }
  ```
- **400 BAD_REQUEST** if `Idempotency-Key` missing or non-printable-ASCII.
- **403 FORBIDDEN_ORIGIN** if `Origin` is present and does not match
  the receiving host/scheme.
- **409 NOT_SUBMITTED** if the session has not been submitted yet
  (`session.status !== 'submitted'`). Submit must precede pay; the
  browser `/pay` page does the same check via `GET /results/me`.

---

### 8. Liveness

`GET /api/v1/healthz`

- **Auth**: none.
- **200 OK** `{ "status": "ok", "version": "v1", "ts": "..." }`.

---

## README demo: cookie-jar cURL walkthrough

Pasted verbatim into the README. The evaluator can copy-paste the whole
block against the deployed URL.

```bash
BASE="https://<your-vercel-domain>"
JAR=$(mktemp)

# 1. Create session (cookie lands in $JAR)
curl -sS -c $JAR -b $JAR -X POST "$BASE/api/v1/sessions" -H 'Content-Type: application/json' -d '{}' | jq

# 2. Save all 6 steps
curl -sS -c $JAR -b $JAR -X PATCH "$BASE/api/v1/sessions/me/steps/gender"     -H 'Content-Type: application/json' -d '{"gender":"female"}'
curl -sS -c $JAR -b $JAR -X PATCH "$BASE/api/v1/sessions/me/steps/main_goal"  -H 'Content-Type: application/json' -d '{"mainGoal":"lose_weight"}'
curl -sS -c $JAR -b $JAR -X PATCH "$BASE/api/v1/sessions/me/steps/age"        -H 'Content-Type: application/json' -d '{"ageYears":29}'
curl -sS -c $JAR -b $JAR -X PATCH "$BASE/api/v1/sessions/me/steps/height"     -H 'Content-Type: application/json' -d '{"heightCm":168}'
curl -sS -c $JAR -b $JAR -X PATCH "$BASE/api/v1/sessions/me/steps/weight"     -H 'Content-Type: application/json' -d '{"weightKg":68,"targetWeightKg":62}'
curl -sS -c $JAR -b $JAR -X PATCH "$BASE/api/v1/sessions/me/steps/activity"   -H 'Content-Type: application/json' -d '{"activityLevel":"moderate"}'

# 3. Submit
curl -sS -c $JAR -b $JAR -X POST "$BASE/api/v1/sessions/me/submit" -H 'Content-Type: application/json' -d '{}' | jq

# 4. Teaser
curl -sS -c $JAR -b $JAR "$BASE/api/v1/results/me" | jq

# 5. Pay (mock)
curl -sS -c $JAR -b $JAR -X POST "$BASE/api/v1/pay" \
  -H "Idempotency-Key: $(uuidgen)" -H 'Content-Type: application/json' -d '{}' | jq

# 6. Full result
curl -sS -c $JAR -b $JAR "$BASE/api/v1/results/me" | jq
```

The same flow is reproduced in the `README.md` "Demo path" block against
the deployed URL. A Postman collection was scoped out of the final
deliverable; the cURL cookie-jar walkthrough is the canonical
reproducer.
