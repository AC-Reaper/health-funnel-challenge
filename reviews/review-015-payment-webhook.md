# Review 015: Payment Webhook

## Status

Resolved — reviewed `feature/payment-webhook` at `308f02c`; all three
Important (I001/I002/I003) + the Nice-to-have (N001) fixed on-branch.
See `reviews/resolved-review-items.md` → "review-015".
Closeout re-review completed at `a220c6b`.

Original review (Open) reviewed `feature/payment-webhook` at `308f02c`.

Scope reviewed:

- `lib/payment-webhook.ts`
- `POST /api/v1/payments/checkout`
- `POST /api/v1/payments/webhook`
- `/pay` and `/checkout` browser flow
- `lib/api/rate-limit.ts`, `lib/env.ts`, `lib/api/errors.ts`
- `tests/lib/payment-webhook.test.ts`
- ADR-017 and docs/memory updates

## What I Accept

- The key trust-boundary move is correct for the challenge: the old
  browser-callable `POST /api/v1/pay` grant path is removed, and
  entitlement now flows through a signature-verified provider callback.
- The webhook verifies the HMAC over the raw body before JSON parsing,
  which is the right shape for a Stripe-like callback.
- Reusing unchanged `processPayment()` is a good architecture choice:
  the existing `SELECT ... FOR UPDATE`, idempotency, and already-paid
  semantics remain the source of truth.
- The checkout endpoint is browser-facing and cannot grant entitlement;
  preview smoke confirms checkout leaves the result in `teaser`.
- The mock provider page is a reasonable demo substitute for Stripe
  Checkout: it keeps the secret server-side and makes the browser flow
  still closeable without adding a real payment dependency.
- `PAYMENT_WEBHOOK_SECRET` is modeled as a required env var, and the
  README's openssl HMAC flow is the right falsifiable proof for the
  webhook boundary.

## Verification

- Closeout at `a220c6b`: `npm run typecheck` — pass.
- Closeout at `a220c6b`: `npm test` — pass, 251 tests.
- Closeout at `a220c6b`: `npm run build` — pass; route list includes
  `/api/v1/payments/checkout`, `/api/v1/payments/webhook`, and
  `/checkout`; old `/api/v1/pay` is gone.
- Closeout at `a220c6b`: `npm run db:validate` — pass.
- Closeout at `a220c6b`: `git diff --check main...HEAD` — pass.
- Closeout at `a220c6b`: raw-query grep still returns exactly one
  application callsite: `lib/payment.ts:200`.
- Code re-review verifies I001/I002/I003/N001 are fixed:
  `POST /api/v1/payments/checkout` parses `z.object({}).strict()` via
  `parseJsonBody`; webhook `idempotencyKey` reuses
  `IDEMPOTENCY_KEY_SCHEMA`; invalid signed webhook events map to stable
  `404 NOT_FOUND` / `409 NOT_SUBMITTED`; current docs route the paid
  session proof through checkout plus signed webhook instead of the
  removed `POST /api/v1/pay`.
- Preview smoke against
  `https://project-u415a-24xgpmpdq-jackz1.vercel.app/`:
  - `GET /api/v1/healthz` → 200.
  - old `POST /api/v1/pay` → 404.
  - bad-signature `POST /api/v1/payments/webhook` → 401.
  - fresh session → six steps → submit → teaser → checkout:
    checkout rejects extra body fields with 422, accepts `{}` with
    `status: "pending"`, and `GET /results/me` remains `teaser`.
- Direct signed-success webhook cURL against preview was not verified:
  signing with the local `.env` `PAYMENT_WEBHOOK_SECRET` correctly
  returns 401 because the preview secret differs. The signed-success path
  is covered by code review, unit tests, and the server-action mock
  provider path that keeps the secret server-side.

## Findings

### Blocking

None.

### Important

#### I001 — Checkout endpoint bypasses the project's Zod/body contract

- Impact range: `app/api/v1/payments/checkout/route.ts`, API contract,
  request-body hardening.
- Risk reason: This branch adds a new mutating JSON endpoint, but the
  handler never parses or validates the request body. That means malformed
  JSON, wrong `Content-Type`, or unknown fields are silently accepted as
  long as the cookie/session state is valid. This breaks the repo's
  explicit rule that Zod owns every API boundary and weakens the
  "professional API design" signal. It also drifts from docs/04, which
  says the checkout body is `{}`.
- Suggested fix: Add a local `CheckoutBody = z.object({}).strict()` and
  run `parseJsonBody(req, CheckoutBody, requestId)` after rate limit and
  before returning any checkout success. Add at least one regression that
  proves `{ "extra": true }` or malformed JSON cannot create a checkout.
- Closeout: Resolved at `a220c6b`. The checkout route now runs
  `parseJsonBody(req, z.object({}).strict(), requestId)` before session
  readiness checks; preview smoke confirms `{ "extra": true }` returns
  422 while `{}` returns `pending`.

#### I002 — Webhook idempotency keys bypass the printable-ASCII hardening

- Impact range: `lib/payment-webhook.ts`, `payment.idempotency_key`,
  replay/idempotency safety evidence.
- Risk reason: The old browser payment route used
  `IDEMPOTENCY_KEY_SCHEMA`, which was hardened in review-009 to allow only
  1-128 printable ASCII chars. The new webhook body schema accepts any
  string up to 128 chars, so a signature-valid payload can store newline,
  control, or non-ASCII idempotency keys in `payment.idempotency_key`.
  Because webhook is now the only grant path, this reopens an input class
  that the project already deliberately closed.
- Suggested fix: Reuse `IDEMPOTENCY_KEY_SCHEMA` for
  `WEBHOOK_PAYLOAD_SCHEMA.idempotencyKey` or apply the same printable-ASCII
  refinement. Add tests for `"\n"`, `"\0"`, and a non-ASCII key.
- Closeout: Resolved at `a220c6b`. `WEBHOOK_PAYLOAD_SCHEMA` now reuses
  `IDEMPOTENCY_KEY_SCHEMA`, with regressions for newline, NUL, non-ASCII,
  and a valid printable key.

#### I003 — Current docs and memory still contradict ADR-017 in several places

- Impact range: `docs/02-architecture.md`, `docs/04-api-design.md`,
  `docs/08-security-hardening.md`, `docs/03-database-design.md`,
  `README.md`, and `memory/shared-memory.md`.
- Risk reason: The implementation removes `POST /api/v1/pay`, but several
  "current" docs still tell the evaluator that it exists or show it in the
  canonical cURL flow. Examples:
  - `docs/02-architecture.md` still lists the MVP scope as browser `/pay`
    plus mock API `POST /api/v1/pay`, and §5 still describes the old
    `/pay` transaction.
  - `docs/04-api-design.md` authentication still lists mutating routes as
    including `POST /pay`, the 429 row still names `/pay`, and the
    README-demo block still calls `POST "$BASE/api/v1/pay"`.
  - `docs/08-security-hardening.md` still points the Zod `.strict()` proof
    at deleted `app/api/v1/pay/route.ts`.
  - `memory/shared-memory.md` final goal / confirmed flow still says the
    result is gated on mock `POST /api/v1/pay`.
  This is not just cosmetic: the API doc's cURL block now gives a 404 on
  the preview URL, which hurts delivery reproducibility.
- Suggested fix: Make ADR-017 explicitly supersede the old ADR-006 route
  shape everywhere that claims to be current. Update `docs/02` MVP scope
  and permission section, `docs/04` same-origin/rate-limit rows and cURL
  block, `docs/08` proof table, `docs/03` payment-index wording, and
  `memory/shared-memory` final flow. Historical review files can stay
  historical; current docs should not point to a deleted endpoint.
- Closeout: Resolved at `a220c6b`. Current docs and shared memory now
  describe checkout plus signed webhook as the grant path. Remaining
  `api/v1/pay` mentions are historical review/ADR context or branch-name
  references, not current instructions.

### Nice-to-have

#### N001 — Signature-valid invalid-session webhooks currently surface as 500

- Impact range: `app/api/v1/payments/webhook/route.ts`,
  `lib/payment.ts:processPayment`.
- Risk reason: A validly signed webhook for a deleted session or a
  not-submitted session reaches `processPayment()`, which throws and is
  mapped to `500 INTERNAL_ERROR`. In a real provider model, that tells the
  provider to retry a permanent bad event. This does not let a browser
  mint paid, but it is a rough edge in the new provider-facing contract.
- Suggested fix: After signature and schema validation, either pre-read the
  session and return `404 NOT_FOUND` / `409 NOT_SUBMITTED`, or make
  `processPayment()` throw typed errors that the webhook route maps to
  stable 4xx envelopes.
- Closeout: Resolved at `a220c6b`. The webhook route pre-reads the
  session after signature/schema validation and returns `404 NOT_FOUND`
  for unknown sessions and `409 NOT_SUBMITTED` for unsubmitted sessions.

## Final Recommendation

No Blocking, Important, or Nice-to-have findings remain. The branch is
mergeable from the review-015 perspective.
