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
- 2026-05-18: Re-reviewed `feature/session-progress-api` at `11098e3`. Body validation, server-only boundaries, stale payment code, and DTO docs are fixed locally; live `POST /sessions` happy-path smoke remains pending on T-102.
- 2026-05-18: Scanned `db992ab`; live Supabase smoke coverage is sufficient to close review-002 I004 for T-101/T-104/T-105. Branch is mergeable from the session-foundation review perspective; step API review still needed after T-202.
- 2026-05-18: Reviewed `feature/funnel-persistence-api` at `f1ae3b3`. `typecheck`, 67 Vitest tests, and build pass, but review-002 is reopened for step API findings: inherited step-key guard bug, weight/main_goal edit coherence, stale session cache, and missing route-level regression tests.
- 2026-05-18: Re-reviewed `feature/funnel-persistence-api` closeout at `36f8830`. B002, I005, I006, and N004 are fixed in code/tests/docs; I007 is accepted as resolved-partial with pure helper tests plus recorded live Supabase smoke. `typecheck`, 108 Vitest tests, and build pass. Branch is mergeable from the step-API review perspective.
- 2026-05-19: Reviewed Day-3 `feature/assessment-result-api` at `d79959c` and wrote `reviews/review-006-day3.md`. `typecheck`, 160 Vitest tests, and build pass. Review is Open with 1 Blocking (missing committed idempotency regression tests for `/submit` and `/pay`), 2 Important (submit-time cross-field coherence; 52-week curve truncation), and 3 Nice-to-have.
