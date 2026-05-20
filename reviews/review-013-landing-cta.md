# Review 013: Landing CTA

## Status

Resolved — reviewed `feature/landing-cta` at `f3ea061`.

Scope reviewed:

- `app/page.tsx` converted to a dynamic, session-aware server
  component.
- New pure `lib/landing-cta.ts:resolveLandingCta`.
- New `tests/lib/landing-cta.test.ts`.
- `docs/02-architecture.md` note for the state-aware landing CTA.
- `memory/open-questions.md` Q-007 restart deferral.

Worktree note: `docs/00-product-research.md` and
`docs/01-requirements.md` have pre-existing uncommitted edits. They
are outside the committed `f3ea061` diff and were not included in this
review.

## What I Accept

- The pure `resolveLandingCta()` state table matches the product
  behaviour:
  - no session → Start
  - empty draft → Start
  - draft with progress → Continue
  - submitted session → View results
- `app/page.tsx` keeps I/O thin: cookie verification, session lookup,
  optional assessment lookup for drafts, then pure CTA resolution.
- The submitted-session path now sends the user directly to `/results`
  with matching copy, instead of promising "Start the quiz" and then
  silently redirecting through `/funnel`.
- Q-007 correctly defers explicit restart/start-over. A visitor/session
  model would be a real architecture change and is not needed to fix the
  misleading CTA.
- No API, DB, cookie, payment, or entitlement behaviour changed.

## Verification

- `npm run typecheck` — pass.
- `npm test` — pass, 228 tests.
- `npm run build` — pass; `/` is now dynamic as expected.
- `npm run db:validate` — pass.
- `git diff --check main...HEAD` — pass.
- Local cookie-jar smoke with `npm run start -- -p 3013`:
  - no cookie landing → "Start the quiz"
  - empty draft session landing → "Start the quiz"
  - draft with saved `gender` landing → "Continue the quiz"
  - submitted session landing → "View your results"

## Findings

### Blocking

None.

### Important

None.

### Nice-to-have

None.

