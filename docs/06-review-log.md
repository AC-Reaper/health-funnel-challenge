# 06 — Review Log

> **Purpose.** Index of every review cycle and its status. The full
> review reports live in `reviews/review-NNN-*.md`; per-finding
> resolutions live in `reviews/resolved-review-items.md`. This file is
> the rolled-up view.
>
> **Owner.** Codex maintains the `Status` and `Notes` columns; Claude
> updates after resolving findings. New review files = new row.
>
> **Status values.** `Open` (findings raised, not yet addressed),
> `Resolved-in-design` (design updated, code not yet shipped),
> `Resolved` (code shipped + verified), `Pending` (review not yet
> performed).

## Reviews

| Review | Area | Status | Notes |
| - | - | - | - |
| review-000-baseline-readiness | Baseline readiness | Closed-informed | Findings informed the v1/v2 design and scaffold rewrite. |
| review-001-architecture | Architecture | Resolved-in-design | Codex re-reviewed v2; Blocking architecture findings are resolved in design. Implementation verification remains pending. |
| review-002-api | API | Resolved | Re-reviewed `feature/funnel-persistence-api` at `36f8830`: step API has no open Blocking/Important findings; I007 route tests accepted as partial with pure tests + live smoke. Day-3 submit/result/pay API still pending future review. |
| review-003-db | Database | Resolved | Re-reviewed `feature/db-schema` on 2026-05-18. Original 1 Blocking + 4 Important are resolved; 1 docs-only Nice-to-have remains. |
| review-004-final | Final | Pending | Triggers Day 5 after T-501. |
| review-005-governance-scaffold | Governance scaffold | Resolved-in-design | No Blocking findings. Claude addressed I001/I002/I003/I005/N001/N002; Codex recorded Owner decisions for Q-002/Q-003/Q-006 and resolved I004 in design. |
| review-006-day3 | Day-3 submit/result/pay | Resolved | Re-reviewed `feature/assessment-result-api` at `7b17949`: B001/I001/I002/N001/N002 resolved; N003 deferred to Day-4 browser UX. No open Blocking/Important findings. |
| review-007-browser-smoke | Deployed browser smoke | Open | Preview URL `https://project-u415a-oafjf8eba-jackz1.vercel.app/` now passes full browser smoke: no-cookie `/pay` redirects to `/`, incomplete sessions see `Finish the quiz first`, and quiz → teaser → `/pay` → full result works. Open only because production alias `https://project-u415a.vercel.app/` was previously stale and has not been re-verified as final URL. |
