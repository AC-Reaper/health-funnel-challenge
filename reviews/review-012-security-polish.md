# Review 012: Security Polish

## Status

Resolved — reviewed `feature/security-polish` at `ba15dac`; I001
(stale README counts) fixed on-branch. See
`reviews/resolved-review-items.md` → "review-012".

Original review (Open) reviewed `feature/security-polish` at `ba15dac`.

Scope reviewed:

- `poweredByHeader: false` in `next.config.mjs`.
- Mock-payment production boundary documentation.
- Conservative CSP deferral documentation.
- README payment-row caveat.

Worktree note: `docs/00-product-research.md` and
`docs/01-requirements.md` have pre-existing uncommitted changes in the
working tree. They are outside the committed `ba15dac` diff and were
not included in this review.

## What I Accept

- `next.config.mjs` now sets `poweredByHeader: false` without changing
  the existing `outputFileTracingRoot` or global security headers.
- `docs/08-security-hardening.md` correctly frames the current CSP as a
  conservative baseline, and avoids the risky "just add strict CSP"
  path that can break the Next App Router without nonce plumbing or a
  Report-Only rollout.
- `docs/08-security-hardening.md` and README now explicitly state that
  browser-callable `/api/v1/pay` is an intentional mock-payment demo
  shortcut, while real production entitlement should come from a
  provider webhook verified server-side.

## Verification

- `npm run typecheck` — pass.
- `npm test` — pass, 224 tests.
- `npm run build` — pass.
- `npm run db:validate` — pass.
- `git diff --check main...HEAD` — pass.
- `npm audit --omit=dev` — pass, found 0 vulnerabilities.
- Local header smoke with `npm run start -- -p 3012`:
  - `HEAD /api/v1/healthz` has baseline security headers and no
    `X-Powered-By`.
  - `HEAD /api/v1/sessions/me` has baseline security headers,
    `cache-control: private, no-store, max-age=0`, and no
    `X-Powered-By`.
  - `HEAD /pay` redirects as expected without `X-Powered-By`.

## Findings

### Blocking

None.

### Important

#### I001 — README headline still reports the pre-review-011 test/review state

- Impact range: Primary evaluator-facing README status and submission
  summary.
- Evidence:
  - `README.md:55-57` still says "222 unit tests" and "eleven Codex
    reviews (000…010) Resolved".
  - `README.md:126` still says `npm test` runs 222 unit tests.
  - `README.md:335` still says "222 个 vitest 单元 + 10 轮 Codex 评审".
- Risk reason: The branch now builds and tests at 224 tests, and
  `review-011-production-hardening` is already resolved on main. The
  README is the main submission artifact; stale counts make the final
  package look less carefully closed than the code actually is.
- Suggested fix: Update README to the current truth. At minimum:
  `224 unit tests`, `review-011 Resolved` / `reviews 000…011
  Resolved`, and the Chinese summary line should match. To avoid
  repeated churn, consider phrasing the review count as "Codex review
  log current in docs/06-review-log.md" plus the latest resolved review
  id, rather than a hard-coded round count in multiple places.

### Nice-to-have

None.

