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
| review-004-final | Final | Resolved | Final re-review at `f2b37f8`: typecheck, 184 tests, db:validate, and build pass. All review-004 findings I001/I002/I003/I004/N001 are resolved; no Blocking, Important, or Nice-to-have findings remain. |
| review-005-governance-scaffold | Governance scaffold | Resolved-in-design | No Blocking findings. Claude addressed I001/I002/I003/I005/N001/N002; Codex recorded Owner decisions for Q-002/Q-003/Q-006 and resolved I004 in design. |
| review-006-day3 | Day-3 submit/result/pay | Resolved | Re-reviewed `feature/assessment-result-api` at `7b17949`: B001/I001/I002/N001/N002 resolved; N003 deferred to Day-4 browser UX. No open Blocking/Important findings. |
| review-007-browser-smoke | Deployed browser smoke | Resolved | Production URL `https://project-u415a.vercel.app/` passes browser smoke: no-cookie `/pay` redirects to `/`, quiz → teaser → `/pay` → full result works. Preview protection issue also resolved. Day 4 is fully closed from review perspective. |
| review-008-frontend-polish | Frontend polish | Resolved | Re-reviewed `feature/frontend-polish` at `c974fbb`: I001 is fixed; typecheck, 184 tests, build, db:validate, and Preview smoke pass. No open Blocking, Important, or Nice-to-have findings remain. |
| review-009-security-hardening | Security hardening | Resolved | Third re-review at `bcb4f2a`: typecheck, 206 tests, build, db:validate, diff-check, and raw-query grep pass. I001 and N001 are resolved; no Blocking, Important, or Nice-to-have findings remain. |
| review-010-delivery-compliance | Delivery compliance | Resolved | Re-reviewed `feature/delivery-compliance-hardening` at `a14b90f`: I001 and N001 are resolved. `typecheck`, 210 tests, build, `db:validate`, and diff-check pass; initial review's live paid-session cURL smoke against production remains valid. No Blocking, Important, or Nice-to-have findings remain. |
| review-011-production-hardening | Production hardening | Resolved | Re-reviewed `feature/production-hardening` at `06817a5`: I001/I002/N001/N002 are resolved. `typecheck`, 224 tests, build without the lockfile warning, `db:validate`, diff-check, prod audit, and `npm ls next postcss` pass. No Blocking, Important, or Nice-to-have findings remain. |
| review-012-security-polish | Security polish | Resolved | README count/status drift fixed after `ba15dac`; review-012 is Resolved in `reviews/review-012-security-polish.md` and `reviews/resolved-review-items.md`. `typecheck`, 224 tests, build, `db:validate`, diff-check, prod audit, and local header smoke pass. |
| review-013-landing-cta | Landing CTA | Resolved | Reviewed `feature/landing-cta` at `f3ea061`: state-aware landing CTA logic is correct and Q-007 restart deferral is reasonable. `typecheck`, 228 tests, build, `db:validate`, diff-check, and local cookie-jar CTA smoke pass. No Blocking, Important, or Nice-to-have findings remain. |
| review-014-rate-limit | Rate limiting | Resolved | Closeout re-review at `c5aadc3`: N001 fixed via keyed HMAC-SHA256 identity hash and accurate `lib/payment.ts:200` raw-query citation. `typecheck`, 240 tests, build, `db:validate`, diff-check, raw-query grep, and preview 429 smoke pass. No Blocking, Important, or Nice-to-have findings remain. |
