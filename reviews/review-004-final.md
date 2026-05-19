# Review 004: Final

## Status

Resolved — 2026-05-19, final re-reviewed at `f2b37f8`

Original branch reviewed: `feature/day5-hardening` at `1d55b1b`

Scope reviewed:
- T-501: server-side cookie TTL in `lib/session.ts` and `tests/lib/session.test.ts`
- T-502: `step_event` Prisma model, migration, and PATCH transaction write
- T-503: DB schema diagram and table docs
- T-504: AI collaboration log
- Whole-repo final pass against the Day-1..Day-5 scoring criteria

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 181 tests
- `npm run db:validate` — pass
- `npm run build` — pass

## Overall Assessment

The shipped product is in good shape from an engineering and interview-demo
standpoint. The core loop is deployed and browser-smoked, the paywall is
server-enforced, the paid/free serializers are separated and leak-tested,
payment replay semantics are DB-backed, and Day-5 hardening added a real
server-side cookie TTL plus a minimal audit table without expanding into a
SaaS-shaped system.

I found no Blocking issues in application behavior, schema validity, or build
health. The remaining risk is mostly final-deliverable polish: several docs
still describe earlier design states. Because API design, DB modelling, README
reproducibility, and AI-collaboration evidence are explicit scoring artefacts,
I would clean these up before final submission instead of deferring them.

## Blocking

None.

## Important

### I001 — DB / architecture docs still describe the pre-`step_event` schema in several places

- Impact range: `docs/03-database-design.md`, `docs/02-architecture.md`, T-502/T-503 proof, DB-modelling score.
- Risk reason: The actual schema now has five tables and a `step_event` index, but the DB doc still opens with "Four tables", says `step_event` is deferred/may ship later, omits `step_event(session_id, created_at)` from the consolidated index list, and says `\dt` should show four tables. The architecture doc also still frames `step_event` as optional / cut-by-default work and keeps ADR-009 as "deferred". A reviewer reading docs before code will see contradictory claims about whether the audit table is real.
- Suggested fix: Update `docs/03-database-design.md` to say five tables, list `step_event` in the overview and §5 index list, add the second migration to the runbook, update the sanity check to five tables, and remove the "will ship if reopened" line. Update `docs/02-architecture.md` §0/§3/§7/§9 so ADR-009 is accepted-and-shipped on Day 5, `step_event` is described as implemented optional hardening, and the risk/plan sections no longer read as pre-implementation.

References:
- `docs/03-database-design.md:14`
- `docs/03-database-design.md:25`
- `docs/03-database-design.md:226`
- `docs/03-database-design.md:253`
- `docs/03-database-design.md:259`
- `docs/02-architecture.md:3`
- `docs/02-architecture.md:29`
- `docs/02-architecture.md:160`
- `docs/02-architecture.md:255`
- `docs/02-architecture.md:295`

### I002 — API/auth documentation is stale after the cookie TTL change

- Impact range: `docs/04-api-design.md`, ADR-014/T-501 proof, API/security scoring, evaluator understanding of expired-cookie behavior.
- Risk reason: The implementation signs `{sid, iat}` and rejects missing, non-integer, future, expired, or tampered `iat`. The API doc still says the cookie contains only `{sid, sig}`, references a non-existent `lib/session.resolveCookie(req)`, and its header still says the doc is awaiting implementation / Codex review for ADR-001..013. This hides the Day-5 security hardening and makes the canonical API doc disagree with `lib/session.ts` and ADR-014.
- Suggested fix: Update `docs/04-api-design.md` status to final/current, include ADR-014 in the decision index/status line, document the opaque cookie payload as `{sid, iat, sig}` with `sig = HMAC(sid.iat)`, mention server-side 30-day TTL + 60-second future skew tolerance, and replace `resolveCookie(req)` with the actual `verifyCookie(...)` / route-handler cookie resolution pattern. Add the expired-cookie behavior to the `401 NO_SESSION` row.

References:
- `docs/04-api-design.md:3`
- `docs/04-api-design.md:25`
- `docs/04-api-design.md:30`
- `lib/session.ts:17`
- `lib/session.ts:36`
- `lib/session.ts:47`
- `memory/decisions.md:173`

### I003 — Final delivery docs/checklist are not yet submission-ready

- Impact range: `README.md`, `docs/07-delivery-checklist.md`, `docs/04-api-design.md`, final repo first impression, AI-collaboration / reproducibility score.
- Risk reason: The README status is mostly current, but it still points to ADR-001..013 only, says Day 3 is "awaits Codex re-review", and lists planned branches that do not match the actual Day-5 branch history. The delivery checklist is still mostly unchecked, includes a required `npm run lint` despite no lint script, and asks for a Postman collection that does not exist; `docs/04` also claims a Postman collection mirrors the cURL flow. This creates a false impression that final DoD is incomplete or that promised artefacts are missing.
- Suggested fix: Refresh README to ADR-001..014, remove stale Day-3 re-review wording, and align the branch list with actual shipped branches or make it historical. Update `docs/07-delivery-checklist.md` to mark completed items, remove or mark N/A for `npm run lint` and Postman if they were intentionally cut, and make the review rows reflect review-001/002/003/006/007 resolved plus review-004 open. Remove the `docs/postman-collection.json` claim from `docs/04-api-design.md` unless the file is actually added.

References:
- `README.md:33`
- `README.md:49`
- `README.md:58`
- `docs/07-delivery-checklist.md:13`
- `docs/07-delivery-checklist.md:27`
- `docs/07-delivery-checklist.md:46`
- `docs/04-api-design.md:412`

## Nice-to-have

### N001 — `step_event` write has no committed regression proof beyond code review and live migration notes

- Impact range: `app/api/v1/sessions/me/steps/[stepKey]/route.ts`, `prisma/schema.prisma`, `prisma/migrations/20260519000000_add_step_event/migration.sql`, future analytics/audit confidence.
- Risk reason: The code correctly writes `step_event` inside the PATCH transaction, and the migration validates, but the automated suite has no assertion that a successful PATCH creates an audit row or that failed/out-of-order PATCHes do not. Since `step_event` is optional Day-5 hardening, this is not blocking the demo loop, but it is the only Day-5 data-path feature without a regression artefact.
- Suggested fix: If time allows, add a tiny transaction-orchestrator seam around the PATCH write or a focused integration smoke note that verifies `step_event` row count after one successful PATCH and no row after a rejected PATCH. Keep it small; do not build a full Prisma integration harness just for this.

References:
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts:138`
- `app/api/v1/sessions/me/steps/[stepKey]/route.ts:150`
- `prisma/schema.prisma:97`
- `prisma/migrations/20260519000000_add_step_event/migration.sql:1`

## Re-review — 495b7ed

Re-review date: 2026-05-19

Branch reviewed: `feature/day5-hardening` at `495b7ed`

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 184 tests
- `npm run db:validate` — pass
- `npm run build` — pass

Resolution check:
- I001: partially resolved. `docs/03-database-design.md` now correctly
  describes the five-table schema, `step_event`, the Day-5 migration, and
  the five-table sanity check. `docs/02-architecture.md` now describes
  `step_event` as shipped, but still has stale final-submission and schema
  details listed below.
- I002: resolved. `docs/04-api-design.md` now documents `{sid, iat, sig}`,
  HMAC over `${sid}.${iat}`, the 30-day server-side TTL, the 60-second skew
  tolerance, and `verifyCookie(...)` as the actual route pattern.
- I003: partially resolved. README and `docs/07-delivery-checklist.md` are
  now submission-oriented, and the Postman collection is correctly scoped
  out there. `docs/02-architecture.md` still claims a Postman collection is
  in scope.
- N001: resolved. `lib/step-repo.ts` adds the `StepsTxOps` seam and
  `tests/lib/step-repo.test.ts` adds three regression cases covering
  successful audit writes, weight payload preservation, and no audit write
  after an upsert failure.

### Re-review Blocking

None.

### Re-review Important

#### I004 — `docs/02-architecture.md` still contains stale final-submission and schema claims

- Impact range: `docs/02-architecture.md`, final architecture evidence, DB-modelling score, delivery-readiness score.
- Risk reason: The repo is otherwise in final-submission shape, but the main architecture doc still has several contradictions: the section title says `ADR-001…013` while the table and project now include ADR-014; MVP scope still promises a Postman collection even though README / docs/04 / docs/07 correctly say it was cut; the logical schema still lists `result.bmi decimal(4,2)`, `payment.idempotency_key text`, and `payment.currency text` even though the actual schema and DB doc use `decimal(5,2)`, `varchar(128)`, and `char(3)`; and the "Open follow-ups" section still says docs/03 and docs/04 need to be fleshed out. An evaluator reading `docs/02` first can conclude that the project has missing promised artefacts or schema drift even though the code is correct.
- Suggested fix: Refresh `docs/02-architecture.md` only: change the heading to ADR-001…014; remove the Postman collection from MVP scope or explicitly say it was intentionally scoped out in favour of the cURL cookie-jar walkthrough; align the schema bullets with `prisma/schema.prisma` / `docs/03-database-design.md`; change the Day-1 historical note to avoid implying ADR-014 is absent; replace the stale "Open follow-ups" section with "None for submitted MVP" or the remaining owner-only submission checklist; then update `reviews/resolved-review-items.md` to avoid marking I001/I003 fully closed before this doc is fixed.

References:
- `docs/02-architecture.md:15`
- `docs/02-architecture.md:49`
- `docs/02-architecture.md:144`
- `docs/02-architecture.md:156`
- `docs/02-architecture.md:159`
- `docs/02-architecture.md:230`
- `docs/02-architecture.md:301`

### Re-review Nice-to-have

None.

## Final Re-review — f2b37f8

Re-review date: 2026-05-19

Branch reviewed: `feature/day5-hardening` at `f2b37f8`

Verification run:
- `npm run typecheck` — pass
- `npm test` — pass, 184 tests
- `npm run db:validate` — pass
- `npm run build` — pass

Resolution check:
- I001: resolved. `docs/03-database-design.md` and
  `docs/02-architecture.md` now both represent the shipped five-table
  model, Day-5 `step_event`, and ADR-009/ADR-014 state consistently.
- I002: resolved. API/auth docs match the server-side cookie TTL
  implementation.
- I003: resolved. README, API docs, delivery checklist, and architecture
  scope now agree on final deliverables; Postman is explicitly scoped out
  in favour of the cURL cookie-jar walkthrough.
- N001: resolved. The `StepsTxOps` seam and 3 committed Vitest cases give
  lightweight regression proof for the `step_event` write path.
- I004: resolved. `docs/02-architecture.md` no longer contains the stale
  ADR heading, Postman in-scope claim, old schema field types, or obsolete
  open-followups.

Final findings:
- Blocking: none.
- Important: none.
- Nice-to-have: none.

## Recommendation

Review-004 is closed. From the reviewer perspective, `feature/day5-hardening`
is ready to merge to `main` and use as the final submitted repo state.
