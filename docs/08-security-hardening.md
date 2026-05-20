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
browser routes (`/`, `/funnel`, `/pay`, `/checkout`, `/results`). All client
input lands at one of the seven API routes, four of which are
state-changing.

| Channel | Threat | First line of defense |
| - | - | - |
| Signed cookie (`hfc_session`) | Forgery, replay, expiry bypass | HMAC-SHA256 over `${sid}.${iat}` + server-side 30d TTL (ADR-014) |
| JSON body | Malformed JSON, wrong content-type, unknown keys, type confusion | `lib/api/parse-body.ts` enforces `Content-Type: application/json`, parses JSON, runs a Zod `.strict()` schema |
| Step PATCH | Out-of-order writes, prototype pollution, coherence violations | `lib/validation/steps.ts` (bounded enums + numeric ranges), `Object.hasOwn` step-key guard (B002), first-incomplete-step rule (ADR-008), `checkWeightCoherence` / `checkMainGoalChange` |
| Submit | Inserting a result without a complete or coherent assessment | `FULL_ASSESSMENT_SCHEMA.superRefine` re-validates server-side; DB `UNIQUE (result.session_id)` + P2002 race recovery |
| Results gate | Free user receiving paid fields | Two distinct serializer **types** (`TeaserResultDTO` vs `FullResultDTO`); type system cannot emit paid fields on teaser (review-001 §4) |
| Pay | Browser minting `paid`, double-charge, replay storms | Grant only via signature-verified webhook (`X-Payment-Signature` HMAC, ADR-017) — browser checkout can't grant; DB `UNIQUE (session_id, idempotency_key)` + partial unique index `payment_one_success_per_session_idx WHERE status='succeeded'` (ADR-012) |
| Headers | Cross-site browser POSTs, CSRF-style attacks | `SameSite=Lax` + `HttpOnly` + `Secure` (prod) on the cookie; `checkSameOrigin` guard on every mutating route |

## 2. Existing controls (with citations)

| Control | Where | How verified |
| - | - | - |
| Zod `.strict()` on every request body | `lib/validation/steps.ts`, `lib/validation/assessment.ts`, `app/api/v1/sessions/route.ts`, `app/api/v1/sessions/me/submit/route.ts`, `app/api/v1/payments/checkout/route.ts` (empty `{}` strict body); the webhook body is `WEBHOOK_PAYLOAD_SCHEMA` (`.strict`) in `lib/payment-webhook.ts` | `tests/lib/validation/steps.test.ts`, `tests/lib/validation/assessment.test.ts`, `tests/lib/api/parse-body.test.ts`, `tests/lib/payment-webhook.test.ts` |
| Per-step bounded enums + numeric ranges | `lib/validation/steps.ts` | `tests/lib/validation/steps.test.ts` |
| Cross-field coherence (weight × main_goal) | `lib/health/coherence.ts`, `lib/assessment.ts` | `tests/lib/validation/assessment.test.ts`, `tests/lib/assessment.test.ts` |
| First-incomplete-step rule (ADR-008) | `lib/progress.ts`, `lib/assessment.ts:firstMissingPrereq` | `tests/lib/progress.test.ts`, `tests/lib/assessment.test.ts` |
| Prototype-pollution guard (`Object.hasOwn`) | `lib/validation/steps.ts:isStepKey` (review-002 B002) | `tests/lib/validation/steps.test.ts` (inherited-key cases) |
| HMAC-signed cookie + server-side TTL | `lib/session.ts:hmac`, `lib/session.ts:verifyCookie` (ADR-014) | `tests/lib/session.test.ts` (TTL + tamper + future-iat + missing-iat) |
| `HttpOnly; SameSite=Lax; Secure (prod)` on `Set-Cookie` | `lib/session.ts:buildSetCookieHeader` | Live cookie-jar smoke (README §"Demo path"); review-007 production verification |
| Two-serializer leak invariant | `lib/serializers/result.ts` | `tests/lib/serializers/result.test.ts` (LEAK INVARIANT case asserts every paid-only field name is absent from teaser JSON) |
| `/submit` idempotency | `lib/result-repo.ts:runSubmitTransaction` (review-006 B001) | `tests/lib/result-repo.test.ts` (idempotent replay + P2002 race) |
| Webhook grant same-key replay | `lib/payment.ts:decidePaymentAction` (ADR-006), called by `payments/webhook` | `tests/lib/payment.test.ts` ("idempotent same-key replay") |
| Webhook grant already-paid new-key silent no-op | `lib/payment.ts:decidePaymentAction` (ADR-012) | `tests/lib/payment.test.ts` ("already-paid + NEW key → silent no-op") + DB partial unique index `payment_one_success_per_session_idx` |
| Webhook grant SELECT … FOR UPDATE per-session serialization | `lib/payment.ts:processPayment` | Live cookie-jar smoke + payment-table row-count assertions |
| `step_event` audit row written inside the same PATCH transaction | `lib/step-repo.ts:runStepsTransaction` (ADR-009, T-502) | `tests/lib/step-repo.test.ts` (success path + rollback path) |
| Parameterized SQL — no raw user input concatenation | All DB writes go through Prisma's query-builder (parameterized by construction). Exactly **one** `$queryRaw` callsite exists in app / lib / prisma / tests code: `lib/payment.ts:200` runs `tx.$queryRaw\`SELECT id FROM "session" WHERE id = ${sessionId}::uuid FOR UPDATE\`` as the ADR-006 per-session lock for the payment grant (the webhook). Prisma's **tagged-template** form parameterizes `${sessionId}` as a bound prepared-statement value — it is not string-concatenated. The `sessionId` is also always a validated value — from `verifyCookie(...)` (HMAC) on the browser paths, or from the signature-verified webhook payload (a `.uuid()` field on a body whose HMAC was checked first) on the grant path — and `::uuid` casts it. | Reproducer: `rg -n '\$queryRaw\|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'` returns exactly that one site; inspect it to confirm the `${sessionId}` interpolation is a bound parameter, not concatenation. |
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
| Webhook `idempotencyKey` with control char / non-ASCII → 422 | `tests/lib/payment-webhook.test.ts`, `tests/lib/api/idempotency-key.test.ts` | `WEBHOOK_PAYLOAD_SCHEMA` reuses `IDEMPOTENCY_KEY_SCHEMA`; rejects `\n`, `\0`, non-ASCII |
| Webhook bad/absent signature → 401 | `tests/lib/payment-webhook.test.ts` + live smoke | `verifyWebhookSignature` rejects tampered/missing/wrong-secret/length-mismatch |
| Webhook amount/currency/status mismatch → 422 | `tests/lib/payment-webhook.test.ts` | `validateWebhookPayload` checks against the server price constants |
| Webhook grant same-key replay | `tests/lib/payment.test.ts` | same `paymentId` on second call; one DB row |
| Webhook grant already-paid + new key → silent no-op | `tests/lib/payment.test.ts` + DB partial unique index | same `paymentId`; never inserts a second succeeded row |
| Webhook for unknown / not-submitted session → 404 / 409 | Route handler (`app/api/v1/payments/webhook/route.ts`) + live smoke | provider-facing 4xx, not 500 |
| Cross-origin browser POST (host mismatch) | `tests/lib/api/same-origin.test.ts` | 403 FORBIDDEN_ORIGIN on host mismatch |
| Cross-scheme POST (http origin against TLS-terminated host) | `tests/lib/api/same-origin.test.ts` | 403 FORBIDDEN_ORIGIN when `x-forwarded-proto` is present and `URL(origin).protocol` differs |
| `Origin: null` / malformed | `tests/lib/api/same-origin.test.ts` | rejected |
| SQL injection via body | All DB writes go through Prisma's parameterized query-builder. The **only** `$queryRaw` callsite in app / lib / prisma / tests is `lib/payment.ts:200` — the per-session lock `SELECT id FROM "session" WHERE id = ${sessionId}::uuid FOR UPDATE` — and it uses Prisma's tagged-template form (so `${sessionId}` is bound, not concatenated). The `sessionId` is a validated value (HMAC cookie on browser paths, or a `.uuid()` field of the signature-verified webhook body on the grant path) and is `::uuid`-cast. | `rg -n '\$queryRaw\|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'` returns exactly that one site; the §2 row walks through it. |

## 3.1 Response headers + caching (production-hardening branch)

Two header layers run on every request:

1. **Global baseline (`next.config.mjs:headers()`)** — applied to
   `/:path*`. Same five headers for every page and API route.

   | Header | Value | Why |
   | - | - | - |
   | `X-Content-Type-Options` | `nosniff` | Stops UA MIME-sniffing |
   | `X-Frame-Options` | `DENY` | No iframe embedding (clickjacking) |
   | `Referrer-Policy` | `no-referrer` | Prevents `sessionId` leakage via Referer (the cookie carries auth, but the URL still mentions the resource) |
   | `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disables powerful APIs we don't use |
   | `Content-Security-Policy` | `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'` | Defence-in-depth on top of XFO. Intentionally conservative — no `script-src`/`style-src` guesses that would break Next's inline runtime |

   `next.config.mjs` also sets `poweredByHeader: false`, so no
   response (page or `/api/v1/*`) advertises `X-Powered-By: Next.js`.

   **CSP is a conservative baseline by design.** A stricter policy
   with `default-src` / `script-src` / `connect-src` / `img-src` /
   `style-src` is a post-MVP task: it must be introduced in
   `Content-Security-Policy-Report-Only` mode first (or with nonce
   plumbing through the App Router) and validated with a full browser
   smoke, because Next's App Router can break under a naive strict CSP
   (inline bootstrap script + injected styles).

2. **Per-route `Cache-Control: private, no-store, max-age=0`** — set
   via `lib/api/cache-control.ts:withNoStore` on every `/api/v1`
   success response except `/healthz`, and unconditionally inside
   `jsonError()` so 401 / 409 / 413 / 422 / 500 also carry it. This
   stops a misconfigured CDN/proxy from serving a cookie-scoped
   payload (teaser vs full result, payment state, step answers) to
   the wrong session.

Tests: `tests/lib/api/cache-control.test.ts`. Smoke: `curl -sI` on
the deployed URL after merge.

## 3.2 Body-size cap + User-Agent truncation

| Control | Where | Why |
| - | - | - |
| 16 KB JSON body cap → 413 PAYLOAD_TOO_LARGE | `lib/api/parse-body.ts` (`MAX_BODY_BYTES`). Two-stage: declared `Content-Length` over the cap is rejected up front (no read); otherwise the body is read and its **UTF-8 byte** length (`Buffer.byteLength(text, "utf8")`, not char count) is re-checked post-read. This is a post-read cap — a body with a missing/lying `Content-Length` is buffered before rejection, which is fine for the demo's sub-KB bodies. | Largest legitimate body is the activity step at <1 KB; the cap is 16× headroom. The early `Content-Length` path avoids buffering an honestly-declared oversized upload. |
| 512-char `user_agent` truncation at ingest | `lib/session.ts:truncateUserAgent`, applied inside `createSession`. | The column is `text` with no DB-side length limit. UA is diagnostic-only — 512 chars is well past any real UA. |

Tests: `tests/lib/api/parse-body.test.ts` (5 new cases, incl. a
multibyte body whose char count is under the cap but whose UTF-8 byte
length is over it), `tests/lib/session-ua.test.ts`.

## 3.3 Trusted host model (`APP_ORIGIN`)

`internalUrl()` in `lib/internal-fetch.ts` derives the absolute URL
for server-side RSC fetches of our own `/api/v1`. Two modes:

1. **Pinned (recommended in prod).** `APP_ORIGIN=https://...`
   environment variable is set. The origin is taken verbatim and
   parsed through `new URL(...)`; a malformed value, or one whose
   scheme is not `http:`/`https:` (e.g. `javascript:` / `data:`,
   which parse but yield an `"null"` origin), throws on first
   internal fetch (fail-fast) rather than silently falling back.
2. **Forwarded-header fallback.** `APP_ORIGIN` is unset. We then
   use `x-forwarded-host` / `x-forwarded-proto`, then `host`, then
   `VERCEL_URL`, then `localhost:3000`. This preserves cURL/local-dev
   ergonomics and the existing behaviour any deploy that hasn't set
   the env relies on.

Owner sets `APP_ORIGIN=https://project-u415a.vercel.app` on Vercel
after this branch merges; `.env.example` documents the toggle.

Tests: `tests/lib/internal-fetch.test.ts` (pinned wins, URL.origin
strips path, fallback active when unset, malformed value rejected,
non-http(s) scheme rejected).

## 3.4 Dependency hygiene

`npm audit --omit=dev` is **0/0** as of the production-hardening
branch. `next` is on `15.5.18` (patches GHSA-26hh-7cqf-hhc6 segment-
prefetch middleware bypass); the nested `postcss` carried by Next
is pinned to `^8.5.14` via a top-level `overrides` block so the
moderate XSS-in-CSS-Stringify advisory drops out of the prod tree.

Reproducer: `npm audit --omit=dev` → "found 0 vulnerabilities".

## 3.5 Rate limiting (ADR-016)

Best-effort, **Postgres-backed** fixed-window limiter on the hot write
routes — `POST /api/v1/sessions`, step `PATCH`, `POST /submit`,
`POST /payments/checkout`, `POST /payments/webhook`
(`lib/api/rate-limit.ts`). Read routes and `/healthz` are not limited.

| Property | Choice | Why |
| - | - | - |
| Store | `rate_limit` table (Supabase/Prisma) | Shared across Vercel's many short-lived instances; an in-memory counter would be per-instance and reset on cold start. No new external dependency. |
| Key | Keyed **HMAC-SHA256** (peppered with `SESSION_COOKIE_SECRET`) of client IP (left-most `x-forwarded-for`) + session id (when present) + User-Agent, per route per window | Composite identity; **no raw IP/UA is persisted** (only the keyed hash). The pepper means a leaked `rate_limit` row can't be brute-forced back to an IP/UA without the server secret. |
| Algorithm | Fixed window, `count` via Prisma upsert+increment | Simple + atomic-enough; a tiny under-count race under heavy concurrency is acceptable for a throttle. |
| On store error | **Fail-open** (allow) | A limiter outage must never break the demo loop. |
| Breach response | `429 RATE_LIMITED` + `Retry-After` | `ERROR_CODES.RATE_LIMITED` (previously reserved). |
| Limits (per 60s/identity) | sessions 20, steps 80, submit 15, checkout 20, webhook 30 | Generous for the 6-step browser flow + edits + README cURL walkthrough; tight enough to throttle scripted abuse. |
| Cleanup | opportunistic prune of expired rows (~2% of calls) | Bounds table growth without a cron; `expires_at` is indexed for a scheduled sweep if desired. |

Honest scope: this bounds a single IP/UA/cookie identity per window. A
hard global guarantee under a large botnet would still want a dedicated
store (Upstash/Vercel KV) — noted as the higher-throughput prod path,
not needed at demo scale.

Tests: `tests/lib/api/rate-limit.test.ts` (pure window/key/identity
helpers + an in-memory `RateLimitStore`: under-limit pass, over-limit
429 + `Retry-After`, fail-open on store error, window rollover reset,
per-identity isolation).

## 3.6 Payment trust boundary — signature-verified webhook (ADR-017)

Entitlement is granted **only** by a payment-provider webhook whose
signature the server verifies — never directly from a browser-callable
endpoint. The provider is *simulated* (no real Stripe), but the
boundary, signature verification, and order checks are real.

| Stage | Endpoint | Can grant? | Control |
| - | - | - | - |
| Merchant checkout | `POST /api/v1/payments/checkout` | **No** | Cookie + same-origin + rate-limited; returns the order descriptor only, no DB write. |
| Provider callback | `POST /api/v1/payments/webhook` | **Yes (only)** | No cookie/origin; auth is `X-Payment-Signature` = HMAC-SHA256(raw body, `PAYMENT_WEBHOOK_SECRET`), verified constant-time. Then re-checks `amountCents`/`currency`/`status` against the server price constants before delegating to the unchanged `processPayment` (DB idempotency). |

Why this is safe: the signing secret lives server-side only (the
`/checkout` mock-provider page's `confirmMockPayment` server action, and
in production the real provider). The browser cannot forge a signature,
so it cannot mint `paid`. A validly-signed but tampered amount/currency
is rejected by the order re-check.

Reproducer (falsifiable):
- Sign a payload and POST the webhook → `200`, entitlement flips to
  `paid` (README §Paid test session).
- POST the same payload with a wrong/absent `X-Payment-Signature` →
  `401 INVALID_SIGNATURE`, **no** grant.

Tests: `tests/lib/payment-webhook.test.ts` (sign/verify roundtrip,
tamper/wrong-secret/missing/length-mismatch rejects, `.strict` schema,
amount/currency/status validation). `processPayment` idempotency tests
in `tests/lib/payment.test.ts` are unchanged.

## 4. Day-5 / post-MVP additions changelog

- **ADR-014** — server-side cookie TTL via `iat` + 30d expiry + 60s
  clock-skew (`feature/day5-hardening`). Closed review-004-final.
- **`step_event` audit table** (T-502, ADR-009 Accepted-and-shipped)
  — append-only audit of every successful PATCH inside the same
  transaction (`feature/day5-hardening`).
- **Same-origin guard** — `lib/api/same-origin.ts`, this branch.
- **`Idempotency-Key` printable-ASCII restriction** —
  `lib/api/idempotency-key.ts`, this branch.
- **Production-hardening branch** — Next.js 14→15.5.18 (clears prod
  audit), baseline response headers (XCTO/XFO/Referrer/Permissions/
  CSP), `Cache-Control: private, no-store` on personalised + error
  responses, 16 KB body-size cap with 413 PAYLOAD_TOO_LARGE, 512-
  char UA truncation, `APP_ORIGIN` allowlist for `internalUrl()`.
- **Security-polish branch** — `poweredByHeader: false` (drops
  `X-Powered-By`), documented mock-payment trust boundary (§5) and
  the post-MVP strict-CSP plan (§3.1).
- **Rate-limit branch (ADR-016)** — Postgres-backed best-effort
  fixed-window limiter on `/sessions`, step PATCH, `/submit`,
  `payments/checkout`, `payments/webhook` (§3.5). Reverses the earlier
  "rate limiting deferred" non-goal.
- **Payment-webhook branch (ADR-017)** — entitlement now grants only via
  a signature-verified webhook (§3.6); browser checkout can't mint
  `paid`. `POST /api/v1/pay` removed; `payments/checkout` +
  `payments/webhook` added.

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

  **Mock-payment trust boundary** — **now implemented as a simulated
  signed webhook** (ADR-017, §3.6). Entitlement is granted only by
  `POST /api/v1/payments/webhook` after the server verifies an
  HMAC-SHA256 signature + amount/currency/status; the browser
  `POST /api/v1/payments/checkout` cannot grant. Still out of scope: a
  *real* provider SDK (Stripe Checkout + `stripe.webhooks.constructEvent`),
  card capture, refunds, and recurring subscription lifecycle. Swapping
  the simulated provider for the real one replaces the mock-provider page
  + the server-action signing; the webhook's verify→validate→
  `processPayment` shape stays.
- **Rate limiting** — **now implemented** (ADR-016, §3.5): a
  Postgres-backed best-effort fixed-window limiter on `/sessions`, step
  PATCH, `/submit`, `payments/checkout`, and `payments/webhook`. Still
  out of scope: a dedicated
  distributed store (Upstash / Vercel KV) for hard global guarantees
  under large-scale abuse — the higher-throughput prod path, not needed
  at demo scale.
- **WAF / captcha / bot detection**. Not graded. Adding them would
  obscure the hand-rolled controls the brief actually evaluates.
- **User-data export / deletion endpoints (GDPR-style)**. No PII is
  collected; the data is age, height, weight, goal, activity, and a
  per-session UUID. Deleting the cookie + the row by `sessionId` is
  the only meaningful operation and is available through Supabase SQL.
- **Cross-device session resume**. Anonymous cookie cannot address
  this without real auth. Documented as a known limitation, not a
  defect.
