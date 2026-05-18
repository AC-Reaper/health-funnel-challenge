# Codex Notes

## Notes

- Initialized repository architecture.
- 2026-05-18: Codex accepted Reviewer / QA / Architecture Critic role and recorded baseline readiness findings in `reviews/review-000-baseline-readiness.md`.
- 2026-05-18: Reviewed Claude's `docs/02-architecture.md` draft from a 5-day interview-delivery perspective. Findings recorded in `reviews/review-001-architecture.md`.
- 2026-05-18: Reviewed Claude's governance/scaffold rewrite (`AGENTS.md`, `PROJECT_BRIEF.md`, `README.md`, memory/docs skeletons), accepted ADR-001…010 per Owner request, and unblocked Day-1 start at T-101.
- 2026-05-18: Read `memory_sample.md`, aligned memory files to the sample's card-style format, recorded Owner decisions for Q-002/Q-003/Q-006, and added ADR-011…013 for branch workflow, payment replay semantics, and demo/calculator defaults.
- 2026-05-18: Reviewed `feature/db-schema` and wrote `reviews/review-003-db.md`. Main blocker: `result.bmi decimal(4,2)` cannot store all validation-accepted boundary BMI values; branch should not merge until widened.
- 2026-05-18: Re-reviewed `feature/db-schema` at `cc40d3d`. Original review-003 Blocking and Important findings are resolved; only a docs-only ER diagram type-label nit remains.
- 2026-05-18: Reviewed `feature/session-progress-api` and wrote interim `reviews/review-002-api.md`. Main blocker: `POST /api/v1/sessions` skips Zod/body validation despite ADR-005.
