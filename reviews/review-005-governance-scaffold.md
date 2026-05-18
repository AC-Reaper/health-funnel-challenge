# Review 005: Governance Scaffold and ADR Sign-off

## Status

Resolved-in-design

Re-reviewed on 2026-05-18 after Claude's cleanup and Owner decisions for
Q-002/Q-003/Q-006. No Blocking findings remain, and all Important items are
resolved in design/docs. Implementation verification remains pending.

## Review Date

2026-05-18

## Reviewed Scope

- `AGENTS.md`
- `PROJECT_BRIEF.md`
- `README.md`
- `memory/decisions.md`
- `memory/task-board.md`
- `memory/shared-memory.md`
- `memory/open-questions.md`
- `docs/00-product-research.md`
- `docs/01-requirements.md`
- `docs/03-database-design.md`
- `docs/05-ai-collaboration-log.md`
- `docs/06-review-log.md`
- `docs/07-delivery-checklist.md`
- Cross-check against `docs/02-architecture.md` v2 and `docs/04-api-design.md` v1.

## Reviewer Position

This pass materially improves the project. The repo now has enough governance,
decision history, review traceability, and Day-by-Day work structure to start
Day 1 without ambiguity. From an interviewer perspective, this is useful
evidence of AI collaboration and engineering process rather than empty ceremony.

ADR-001…010 were accepted per Owner request and Q001 was resolved at the
time of this review. ADR-011…013 were added afterward for code management,
payment replay semantics, and demo/calculator defaults. Day 1 may start
with T-101.

## Blocking

None. No issue in this review should block Day-1 implementation.

## Important

### I001: `docs/07-delivery-checklist.md` marks API design as matching shipped endpoints before endpoints exist

- Impact range: `docs/07-delivery-checklist.md`, final delivery readiness.
- Risk reason: A checked item can hide unfinished implementation work. The API doc is drafted, but no route handlers have shipped yet, so "matches the shipped endpoints" cannot be true.
- Suggested fix: Change the `04-api-design.md` row to unchecked until T-105, T-202, T-302, T-303, and T-304 are implemented and verified. Wording can say "draft exists; verify after endpoints ship."

### I002: Review flow omits the Owner-required "risk reason" field

- Impact range: `AGENTS.md` §5, future review consistency.
- Risk reason: The Owner explicitly requires every review item to include impact range, risk reason, and suggested fix. `AGENTS.md` currently requires impact range and suggested fix, but not risk reason, which can cause future reviews to drift from the requested format.
- Suggested fix: Amend review flow step 3 to require impact range, risk reason, and suggested fix for every Blocking / Important / Nice-to-have finding.

### I003: `PROJECT_BRIEF.md` says four deliverables but lists five items

- Impact range: `PROJECT_BRIEF.md`, README framing, evaluator expectation management.
- Risk reason: The fifth item, "Pre-paid demo path", is more accurately proof inside README/API docs than a standalone deliverable. Calling it a fifth deliverable slightly contradicts the requested "4 大交付物" framing.
- Suggested fix: Keep four deliverables and move the cookie-jar paid demo path under the README/demo deliverable as proof evidence.

### I004: Q006 payment replay semantics remains open and should be resolved before T-304

- Impact range: `docs/02-architecture.md`, `docs/04-api-design.md`, `POST /api/v1/pay`, tests.
- Risk reason: The architecture still mentions either no-op or `409` for a different idempotency key after payment, while API v1 defaults to `409 ALREADY_PAID`. Leaving this open too long can cause payment tests and implementation to diverge.
- Suggested fix: Resolve Q006 before Day 3. My recommendation: keep `409 ALREADY_PAID` and do not insert a second payment row for a new key once the session is already paid.

### I005: `docs/02-architecture.md` still uses D1-D6 sign-off language after ADR-001…010 acceptance

- Impact range: `docs/02-architecture.md`, `memory/decisions.md`, onboarding for the next turn.
- Risk reason: The actual gate is now ADR-001…010, all accepted. Stale D1-D6 language can make it look as if only the first six choices were approved.
- Suggested fix: Update the status line and Day-1 gate language in `docs/02-architecture.md` to reference accepted ADR-001…010.

## Nice-to-have

### N001: `memory/task-board.md` has T-106 assigned to Codex even though Claude triggers the review

- Impact range: `memory/task-board.md`, review workflow.
- Risk reason: It is minor, but task ownership is slightly ambiguous: Claude should move the work to Review and request Codex review; Codex owns the review file itself.
- Suggested fix: Split trigger and review if needed: `T-106 Claude requests DB review`, then Codex owns `review-003-db.md`.

### N002: Skeleton docs are clear, but Day-1 docs should avoid becoming a documentation rabbit hole

- Impact range: `docs/00`, `docs/01`, `docs/03`, Day-1 schedule.
- Risk reason: The new Purpose / Owner blocks are helpful, but overfilling research and requirements could eat time before schema/API code starts.
- Suggested fix: Keep Day-1 docs short and testable. Requirements should become R-001…R-NNN with acceptance tests, not prose-heavy product analysis.

## Verified Improvements

- Architecture v1 findings were materially adopted in v2: `/pay` naming, no raw paid `sessionId`, first-incomplete-step progress, simplified entitlement model, and deferred `step_event`.
- `AGENTS.md` now clearly defines owner / implementer / reviewer roles and protects `memory/codex-notes.md` from accidental edits.
- `memory/decisions.md` now has ADR-001…010 and records that ADR-007/008/010 supersede the earlier v1 design.
- `README.md` honestly states no business code exists yet and gives a plausible Day-1 through Day-5 roadmap.
- `memory/task-board.md` now has concrete T-101…T-505 tasks.
- `docs/05-ai-collaboration-log.md` now contains real collaboration evidence instead of generic AI usage claims.
- `docs/07-delivery-checklist.md` captures the submission email recipients and subject-line format, which reduces final-day failure risk.

## Sign-off Result

Approved for Day-1 implementation start. No Blocking findings remain at the
governance/scaffold layer.
