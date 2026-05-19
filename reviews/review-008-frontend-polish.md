# Review 008: Frontend Polish

## Status

Open — 2026-05-19

Branch reviewed: `feature/frontend-polish` at `8f6f80a`

Preview deployment reviewed:
- `https://project-u415a-ljz3rs2mm-jackz1.vercel.app/`

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

Browser smoke:
- Preview desktop flow on `https://project-u415a-ljz3rs2mm-jackz1.vercel.app/`: `/` → `Start the quiz` → `gender` auto-advances after click; non-selected option is disabled during the confirm flash; `main_goal` auto-advances; numeric steps still require `Continue`; full quiz reaches `/results` teaser; `LockedPreview` renders Daily calories / Predicted target date / Weekly curve / Algorithm cards; unlock → `/pay`; `Pay $9.99` → full report.
- Back-then-edit check: after reaching `weight`, clicked Back three times to `main_goal`; changing the goal advanced to `age` rather than jumping back to the server's first incomplete step (`weight`). This verifies `viewStep` is decoupled from `dto.currentStep` for editing flows.
- 360px viewport: the provided preview root and paid full-result page both reported `documentElement.scrollWidth === clientWidth === 360`. Because the preview browser context then held an httpOnly paid cookie and `/funnel` correctly redirected to `/results`, the fresh 360px funnel step check was repeated against the same branch on local `127.0.0.1:3001`; Step 1 and Step 2 also had no horizontal overflow at 360px.

## Overall Assessment

This polish branch improves the product feel without disturbing API, DB, or
test surfaces. The `viewStep` split is the right move: it keeps review/edit
navigation human-friendly while preserving the server as source of truth for
saved progress. The results/pay presentation also reads much more like a
finished funnel than the previous functional shell.

I found no Blocking issues. There is one Important UX-state issue in the new
auto-advance path: if a single-choice save fails and the step remains mounted,
the local confirm-flash state never resets, leaving the choices disabled.

## Blocking

None.

## Important

### I001 — Single-choice auto-advance does not reset `selecting` after a failed save

- Impact range: `StepGender`, `StepMainGoal`, `StepActivity`, auto-advance error recovery, mobile/desktop funnel UX.
- Risk reason: Each single-choice step sets `selecting` before the 250ms timer and disables all options while `selecting !== null`. On success, the component unmounts or navigates, so the state disappears. On failure, however, `FunnelStepper.handleSave()` leaves the user on the same step and sets `error`, but the child component still has `selecting` set. On `gender` there is no Back button, so a transient API error can leave the first step visibly errored and all options disabled. On later single-choice steps the user can recover only by backing out and returning, which is exactly the kind of polish regression this branch is trying to remove.
- Suggested fix: In the auto-advance step components, clear `selecting` when the save finishes without advancing. Keep it small: either `await onSave(...).finally(() => setSelecting(null))` guarded against unmount, or a `useEffect` that resets `selecting` when `pending` becomes false and `error` is present. Apply the same pattern to `StepGender`, `StepMainGoal`, and `StepActivity`. If you prefer deduplication, extract a tiny `useAutoAdvanceChoice` hook; do not introduce a broader state machine.

References:
- `app/funnel/steps/StepGender.tsx:29`
- `app/funnel/steps/StepGender.tsx:38`
- `app/funnel/steps/StepGender.tsx:60`
- `app/funnel/steps/StepMainGoal.tsx:36`
- `app/funnel/steps/StepMainGoal.tsx:45`
- `app/funnel/steps/StepMainGoal.tsx:68`
- `app/funnel/steps/StepActivity.tsx:37`
- `app/funnel/steps/StepActivity.tsx:46`
- `app/funnel/steps/StepActivity.tsx:70`
- `app/funnel/FunnelStepper.tsx:76`
- `app/funnel/FunnelStepper.tsx:83`
- `app/funnel/FunnelStepper.tsx:93`
- `app/funnel/FunnelStepper.tsx:98`

## Nice-to-have

None.

## Recommendation

Fix I001, then re-request a short review. After that, this branch should be
safe to merge from the frontend-polish review perspective.
