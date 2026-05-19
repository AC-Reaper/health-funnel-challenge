# Review 008: Frontend Polish

## Status

Resolved — 2026-05-19

Branch reviewed: `feature/frontend-polish`
- Initial review: `8f6f80a`
- Re-review: `c974fbb`

Preview deployment reviewed:
- `https://project-u415a-ljz3rs2mm-jackz1.vercel.app/`
- Re-review Preview deployment:
  `https://project-u415a-doh7rtyig-jackz1.vercel.app/`

Scope reviewed:
- Auto-advance UX on single-choice steps with 250ms confirm flash and double-click guard.
- Client-only `viewStep` separation for Back-then-edit flows.
- `<LockedPreview />` teaser block and report-style full results.
- 360px mobile viewport sanity.

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 184 tests
- `npm run build` — pass
- `npm run db:validate` — pass

Re-review verification run at `c974fbb`:
- `npm run typecheck` — pass
- `npm test` — pass, 184 tests
- `npm run build` — pass
- `npm run db:validate` — pass

Browser smoke:
- Preview desktop flow on `https://project-u415a-ljz3rs2mm-jackz1.vercel.app/`: `/` → `Start the quiz` → `gender` auto-advances after click; non-selected option is disabled during the confirm flash; `main_goal` auto-advances; numeric steps still require `Continue`; full quiz reaches `/results` teaser; `LockedPreview` renders Daily calories / Predicted target date / Weekly curve / Algorithm cards; unlock → `/pay`; `Pay $9.99` → full report.
- Back-then-edit check: after reaching `weight`, clicked Back three times to `main_goal`; changing the goal advanced to `age` rather than jumping back to the server's first incomplete step (`weight`). This verifies `viewStep` is decoupled from `dto.currentStep` for editing flows.
- 360px viewport: the provided preview root and paid full-result page both reported `documentElement.scrollWidth === clientWidth === 360`. Because the preview browser context then held an httpOnly paid cookie and `/funnel` correctly redirected to `/results`, the fresh 360px funnel step check was repeated against the same branch on local `127.0.0.1:3001`; Step 1 and Step 2 also had no horizontal overflow at 360px.
- Re-review smoke on `https://project-u415a-doh7rtyig-jackz1.vercel.app/`: `/` → `Start the quiz` → `gender` and `main_goal` auto-advance; non-selected options are disabled during the confirm flash; numeric steps can be completed; `activity` auto-submits to `/results`; locked teaser renders; unlock → `/pay`; `Pay $9.99` returns to the full result. The paid full-result page also reports no horizontal overflow at 360px.

## Overall Assessment

This polish branch improves the product feel without disturbing API, DB, or
test surfaces. The `viewStep` split is the right move: it keeps review/edit
navigation human-friendly while preserving the server as source of truth for
saved progress. The results/pay presentation also reads much more like a
finished funnel than the previous functional shell.

Initial review found one Important UX-state issue in the new auto-advance
path: if a single-choice save failed and the step remained mounted, the local
confirm-flash state never reset, leaving the choices disabled.

Re-review at `c974fbb` verifies that I001 is resolved. The branch now clears
`selecting` only after `pending` transitions `true → false`, so the 250ms
confirm flash remains intact while failed PATCH / submit paths unlock the
current step for another click.

## Blocking

None.

## Important

### I001 — Resolved: single-choice auto-advance now resets `selecting` after failed save

- Impact range: `StepGender`, `StepMainGoal`, `StepActivity`, auto-advance error recovery, mobile/desktop funnel UX.
- Risk reason: Each single-choice step sets `selecting` before the 250ms timer and disables all options while `selecting !== null`. On success, the component unmounts or navigates, so the state disappears. On failure, however, `FunnelStepper.handleSave()` leaves the user on the same step and sets `error`, but the child component still has `selecting` set. On `gender` there is no Back button, so a transient API error can leave the first step visibly errored and all options disabled. On later single-choice steps the user can recover only by backing out and returning, which is exactly the kind of polish regression this branch is trying to remove.
- Suggested fix: In the auto-advance step components, clear `selecting` when the save finishes without advancing. Keep it small: either `await onSave(...).finally(() => setSelecting(null))` guarded against unmount, or a `useEffect` that resets `selecting` when `pending` becomes false and `error` is present. Apply the same pattern to `StepGender`, `StepMainGoal`, and `StepActivity`. If you prefer deduplication, extract a tiny `useAutoAdvanceChoice` hook; do not introduce a broader state machine.
- Resolution: `StepGender`, `StepMainGoal`, and `StepActivity` now track `wasPendingRef` and clear `selecting` when `pending` transitions from `true` to `false`. This targets the failure path without clearing the 250ms flash window before the parent has entered `pending=true`.

References:
- `app/funnel/steps/StepGender.tsx:29`
- `app/funnel/steps/StepGender.tsx:31`
- `app/funnel/steps/StepGender.tsx:45`
- `app/funnel/steps/StepMainGoal.tsx:36`
- `app/funnel/steps/StepMainGoal.tsx:38`
- `app/funnel/steps/StepMainGoal.tsx:48`
- `app/funnel/steps/StepActivity.tsx:37`
- `app/funnel/steps/StepActivity.tsx:39`
- `app/funnel/steps/StepActivity.tsx:51`
- `app/funnel/FunnelStepper.tsx:76`
- `app/funnel/FunnelStepper.tsx:83`
- `app/funnel/FunnelStepper.tsx:93`
- `app/funnel/FunnelStepper.tsx:98`

## Nice-to-have

None.

## Recommendation

`feature/frontend-polish` is safe to merge from the frontend-polish review
perspective. No Blocking, Important, or Nice-to-have findings remain.
