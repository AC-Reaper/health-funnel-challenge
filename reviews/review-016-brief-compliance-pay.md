# Review 016: Brief-Compliance Pay

## Status

Open — original review covered PR #1, `feature/brief-compliance-pay` at
`5c59e43` against `main` (`10b1dc3`). Closeout re-review at `b3a1d24`
verifies I002 and N001 are fixed, but I001 remains partially open because
`docs/02-architecture.md` still carries stale ADR-001…017 / pre-ADR-018
status text.

Scope reviewed:

- Restored `POST /api/v1/pay` mock callback.
- New `GET /api/v1/results/by-session` demo read.
- New `npm run seed:demo` / `scripts/seed-demo.sh`.
- ADR-018 and docs/memory updates.
- PR description and the brief-compliance rationale.

## What I Accept

- The direction is right for the interview brief: keep the production-style
  signed webhook, but restore the secret-free mock `/api/v1/pay` path that
  the evaluator can replay without `PAYMENT_WEBHOOK_SECRET`.
- The restored `/api/v1/pay` implementation uses the important guards:
  same-origin, signed cookie, submitted-session gate, rate limiting,
  printable-ASCII `Idempotency-Key`, strict `{}` body validation, and the
  existing `processPayment` transaction.
- Reusing `processPayment` is the correct architecture choice. It avoids a
  second grant implementation and preserves the existing DB idempotency and
  already-paid no-op semantics.
- Adding a paid-sessionId demo path is a pragmatic answer to the brief's
  literal deliverable; it reduces evaluator friction substantially.
- No schema/migration change is appropriate here. The existing `payment`
  table and `session.entitlement_status` model are enough for a 5-day mock
  payment challenge.

## Verification

- Original review: `npm run typecheck` — pass.
- Original review: `npm test` — pass, 251 tests.
- Original review: `npm run build` — pass; route manifest includes `/api/v1/pay` and
  `/api/v1/results/by-session`.
- Original review: `npm run db:validate` — pass.
- Original review: `git diff --check main...HEAD` — pass.
- Original review: raw SQL grep still returns exactly one application callsite:
  `lib/payment.ts:200`.
- Closeout re-review at `b3a1d24`: `npm run typecheck` — pass.
- Closeout re-review at `b3a1d24`: `npm test` — pass, 255 tests.
- Closeout re-review at `b3a1d24`: `npm run build` — pass; route manifest
  still includes `/api/v1/pay` and `/api/v1/results/by-session`.
- Closeout re-review at `b3a1d24`: `npm run db:validate` — pass.
- Closeout re-review at `b3a1d24`: `git diff --check main...HEAD` — pass.
- Closeout re-review at `b3a1d24`: raw SQL grep still returns exactly
  `lib/payment.ts:200`.
- Preview smoke against
  `https://project-u415a-nrsua6m2q-jackz1.vercel.app/`:
  - `BASE=<preview> npm run seed:demo` passes its self-check and prints a
    paid/full session plus a free/teaser session.
  - A normal non-seeded submitted session returns `404` from
    `/api/v1/results/by-session` both before and after payment.
  - Manual cookie-jar `POST /api/v1/pay` grants without
    `PAYMENT_WEBHOOK_SECRET`; `/results/me` changes from `teaser` to
    `full`.

## Findings

### Blocking

None.

### Important

#### I001 — Current docs still contradict ADR-018 in evaluator-facing places

- Impact range: `README.md`, `docs/01-requirements.md`,
  `docs/04-api-design.md`, `app/api/v1/payments/webhook/route.ts`, and
  memory status.
- Risk reason: This PR exists to remove brief-compliance drift, but
  several current docs still say or imply the old webhook-only model.
  Examples:
  - `README.md` still says the review log is current only through
    `review-013`, still says entitlement is granted only by webhook, and
    still has command/email text saying 250 tests / 7 API routes / the
    seed script prints `paymentId`.
  - `docs/01-requirements.md` still says paid entitlement is granted only
    via signed webhook and still lists a raw paid `sessionId` as out of
    scope.
  - `docs/04-api-design.md` still has a stale status header
    (`ADR-001…017`, "eight routes") and its same-origin route list omits
    `POST /api/v1/pay`.
  - `app/api/v1/payments/webhook/route.ts` still comments that the webhook
    is the "ONLY path that grants entitlement", which is false after
    ADR-018.
  This is not cosmetic. The branch is deliberately a delivery-compliance
  patch, so contradictory evaluator-facing docs weaken the exact signal it
  is meant to strengthen.
- Suggested fix: Update all current evaluator-facing docs to the two-path
  ADR-018 truth: mock `/api/v1/pay` is the brief/reviewer grant path, and
  webhook is the production-style grant path. Bump counts to 251 tests and
  the current API route count, update review-status wording, revise
  `docs/01` R-014 and out-of-scope text, add `/pay` to same-origin docs,
  and change webhook comments from "only grant path" to "production grant
  path".
- Closeout at `b3a1d24`: Partially resolved. README, docs/01, docs/04,
  docs/08, the webhook route comment, and memory status now use the
  two-path ADR-018/019 model. However, `docs/02-architecture.md` still
  says the decision gate and accepted-decisions section are ADR-001…017,
  still describes pre-seeded paid sessionId as dropped in the status
  header, and still says R8 is mitigated by ADR-001…017. Because docs/02
  is a linked evaluator-facing architecture artifact, I001 remains open
  until those remaining status/range lines are updated to ADR-001…019 and
  the ADR-018/019 paid-sessionId scope.

#### I002 — `results/by-session` exposes all submitted sessions by bare UUID, not just demo-seeded sessions

- Impact range: `app/api/v1/results/by-session/route.ts`,
  `scripts/seed-demo.sh`, README, and security docs.
- Risk reason: The endpoint is meant to satisfy the paid `sessionId`
  deliverable, but as implemented it lets anyone with any submitted
  session UUID read that session's teaser or full result without the
  signed cookie. UUID guessing is not practical, but UUID leakage through
  logs, screenshots, support messages, or copied docs becomes bearer read
  access to health data. That also conflicts with the repo's privacy/auth
  story that the cookie remains the real credential.
- Suggested fix: Keep the endpoint, but scope it to demo-seeded sessions.
  Define a stable demo seed user-agent such as
  `health-funnel-demo-seed/1.0`; make `seed-demo.sh` send it on session
  creation; make `GET /api/v1/results/by-session` return 404 or 403 unless
  `session.userAgent` matches that marker. Update README/docs to say
  `by-session` is for seeded demo sessions only.
- Closeout at `b3a1d24`: Resolved. `lib/session.ts` defines
  `DEMO_SEED_USER_AGENT` and `isDemoSeedSession`; the by-session route
  returns the same `404 NOT_FOUND` for missing and non-demo sessions; the
  seed script sends the marker UA at session creation; predicate tests
  cover exact match, null, browser UA, and near-misses. Preview smoke
  confirms a normal non-seeded submitted session id returns 404.

### Nice-to-have

#### N001 — `seed:demo` should self-verify the promised paid/free contrast

- Impact range: `scripts/seed-demo.sh`, README paid-session
  reproducibility.
- Risk reason: The script currently prints URLs after creating paid/free
  sessions, but it does not assert that paid returns `kind="full"` and
  free returns `kind="teaser"`. Since this is the evaluator's fastest
  path, a deployment/env issue could produce IDs that look valid but do
  not prove the required contrast.
- Suggested fix: After creating both sessions, have the script call
  `/api/v1/results/by-session` for each and fail fast unless paid is
  `full` and free is `teaser`. Optionally print the paid payment response
  fields if README/email copy claims `paymentId` / `entitlementStatus`.
- Closeout at `b3a1d24`: Resolved. `seed:demo` now self-verifies
  paid/full and free/teaser via `/results/by-session`, fails fast on a
  mismatch, and prints the paid `paymentId` + `entitlementStatus`.
  Preview smoke confirms the script passes against
  `https://project-u415a-nrsua6m2q-jackz1.vercel.app/`.

## Closeout Checks

After fixes, re-run:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run db:validate`
- `git diff --check main...HEAD`
- `rg -n '\$queryRaw|\$executeRaw' app lib prisma tests --glob '!node_modules' --glob '!package-lock.json'`

Live/DB closeout:

- `BASE=<preview-or-live-url> npm run seed:demo`
- Confirm script prints one paid and one free sessionId.
- Confirm paid by-session URL returns `kind="full"`.
- Confirm free by-session URL returns `kind="teaser"`.
- Confirm manual cookie-jar path can call `POST /api/v1/pay` without
  `PAYMENT_WEBHOOK_SECRET`.

## Final Recommendation

Do not merge yet. The grant/read-by-id implementation is now in good
shape, and I002/N001 are verified fixed locally and on the preview. One
Important documentation finding remains: finish the `docs/02-architecture.md`
ADR-001…019/status cleanup so the architecture artifact no longer
contradicts ADR-018/019.
