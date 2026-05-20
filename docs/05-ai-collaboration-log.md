# 05 — AI Collaboration Log

> **Purpose.** Evidence of substantive collaboration with AI agents, not
> code-generation usage. The brief grades this explicitly: "是不是只把
> AI 当代码生成器，还是真的在和它协作". One row per meaningful
> interaction: a decision, a review cycle, a disagreement resolved, a
> mistake caught. Generic "AI helped me write a function" entries do
> not belong here.
>
> **Owner.** Claude appends per turn; Codex appends after each review.
> Owner adds entries when they steer scope.
>
> **What "substantive" means.** The entry must answer: *what was
> proposed → what was challenged → what was decided → why*.

## Entries

| Date | Agent | Phase | Summary | Artefacts |
| - | - | - | - | - |
| 2026-05-18 | Codex | Phase 0 (Scaffold) | Baseline-readiness review of empty scaffold flagged 5 Blocking / 4 Important gaps before implementation could start. | `reviews/review-000-baseline-readiness.md` |
| 2026-05-18 | Claude | Phase 1 (Design) | Architecture v1 drafted with full MVP scope, 6-table data model, 8-endpoint API, 5-day plan, and explicit out-of-scope list. | `docs/02-architecture.md` v1 (now superseded) |
| 2026-05-18 | Codex | Phase 1 (Design) | Architecture review surfaced 3 Blocking and 5 Important issues, most importantly: payment-route naming mismatch with the brief, paid-seed-session/cookie-auth contradiction, step-progress rule allowing skips, and `subscription`+`payment_event` over-design. | `reviews/review-001-architecture.md` |
| 2026-05-18 | Claude | Phase 1 (Design) | Classified each finding as adopt/partial/reject — all material findings adopted. Architecture rewritten as v2; ADR-007…010 added to record the corrections; full API contract written. | `docs/02-architecture.md` v2, `docs/04-api-design.md` v1, `memory/decisions.md` ADR-007…010 |
| 2026-05-18 | Owner + Codex | Phase 1 (Design) | Owner provided memory-format sample, selected English copy, accepted the Mifflin-St Jeor default, chose silent no-op semantics for already-paid `/pay` replays, and defined branch/commit workflow. Codex recorded ADR-011…013 and aligned memory/docs. | `memory_sample.md`, `memory/decisions.md` ADR-011…013, `memory/open-questions.md` Q-002/Q-003/Q-006 |

| 2026-05-18 | Codex | Phase 2 (Day 1 DB) | DB-schema review of `feature/db-schema` caught a real boundary overflow: `Result.bmi` was `decimal(4,2)` but the API admits `heightCm=120, weightKg=250` → BMI ≈ 173.61 which overflows. Three other type tightenings + one ADR-012 backstop. | `reviews/review-003-db.md` (B001 + I001-I003) |
| 2026-05-18 | Codex | Phase 2 (Day 1 API) | API-skeleton review of `feature/session-progress-api` caught that `POST /sessions` accepted any JSON body (B001) and that server-only modules weren't marked, risking client-bundle leaks (I001). | `reviews/review-002-api.md` |
| 2026-05-18 | Codex | Phase 3 (Day 2) | Step-API review caught a prototype-pollution path: `isStepKey` used the `in` operator, so `__proto__` / `toString` passed the guard and crashed downstream (B002). Also flagged main_goal flip incoherence and stale `session.current_step` (I005, I006). | `reviews/review-002-api.md` re-review |
| 2026-05-19 | Codex | Phase 4 (Day 3) | Day-3 review demanded committed Vitest regression tests for `/submit` and `/pay` idempotency (B001 blocking) instead of live smoke alone; also caught the 52-week curve truncation snapping the last point to the goal even when `predictedTargetDate` was already null (I002). | `reviews/review-006-day3.md` |
| 2026-05-19 | Codex | Phase 5 (Day 4) | Browser smoke against the production URL caught that production was still serving the Day-3 placeholder because `feature/frontend-funnel` was unmerged (B001). Re-smoke against the preview URL caught Vercel's default Deployment Protection blocking anonymous access (B002). | `reviews/review-007-browser-smoke.md` |

## Per-phase retrospective

These short sections close at the end of each phase. Each answers:
*what AI did well, what failed, what we would do differently*.

### Phase 0 — Scaffold

Codex's baseline review of the empty repo found 5 Blocking gaps that a
template-style "AI scaffold" would have left silent: no architecture
doc, no API contracts, no DB schema, no runnable code, no working
agreement. The Claude reply addressed all five in the design phase
rather than dismissing them as premature.

The substantive moment: Codex pushed back on Claude proposing a UUIDv7
dependency + an in-memory rate limiter; Claude rejected the in-memory
limiter (serverless invalidates it) and downgraded UUIDv7 to
`crypto.randomUUID()` (UUIDv4) because the brief never required ordered
ids. Both reversals saved scope at a phase where over-engineering had
no payoff.

(Post-MVP follow-up, ADR-016: rate limiting was later added on Owner's
request — but as a **Postgres-backed** best-effort limiter, precisely
the serverless-correct shape the Phase-1 reasoning pointed to, not the
in-memory one that was rejected here.)

### Phase 1 — Design

The biggest reversal of the project. Architecture v1 included a
`subscription` table + a `payment_event` log + a separate
`step_event` audit, all proposed because they "felt right" for a paid
funnel. Codex's review-001 challenged every one of them: subscription
duplicates state already in `session.entitlement_status`,
`payment_event` is a generic log against a model that has exactly two
states, and `step_event` belongs to Day-5 *if there's slack*.

Claude adopted all three cuts. The result: v2 is 4 tables instead of
6, the entitlement gate is a single boolean comparison, and the
test surface shrank by maybe 30% before any code was written.

Reverse direction in the same phase: Claude initially proposed
"pre-seeded paid sessionId for the evaluator" to skip cookie wiring.
Codex pointed out that violates the brief's "one cookie-jar walkthrough
demonstrates the whole flow" criterion. Claude dropped the seed,
wrote the cookie-jar cURL block (now §README), and ADR-010 records the
rationale.

### Phase 2 — Day-1 foundations

Codex's review-003 caught `Result.bmi decimal(4,2)` (B001): the API
admits `heightCm=120, weightKg=250` which is BMI ≈ 173.61, but a
`decimal(4,2)` column can't store anything ≥ 100. Claude widened to
`decimal(5,2)` + added a test in `tests/lib/health/calculator.test.ts`
that pins the exact boundary at 173.61 so the fix can't regress
silently.

Same review introduced ADR-012's DB backstop: a partial unique index
`payment_one_success_per_session_idx ON payment(session_id) WHERE
status='succeeded'`. Prisma can't model partial indexes, so the
constraint lives in the migration SQL only and is documented in
`docs/03-database-design.md` §3 with the explicit rationale that this
is the last line of defense if the application-level "silent no-op"
ever breaks.

Where Claude pushed back: Codex's I002 wanted Prisma `@updatedAt` on
*all* tables, including `payment`. Claude rejected — payment rows are
immutable audit data, an updated_at column on them would be either
always-equal-to-created_at (useless) or evidence of a tamper (which
the schema should refuse, not record). The rejection was accepted.

### Phase 3 — Day-2 funnel persistence

Codex's review-002 step-API pass found a real prototype-pollution
vulnerability: `isStepKey` used the JavaScript `in` operator, so the
literal string `__proto__` passed the guard (because it inherits from
`Object.prototype`) and crashed the route on `STEP_SCHEMAS[__proto__]`
returning a function instead of a schema. Replaced with `Object.hasOwn`
and added two test cases for inherited keys.

Codex's I005 (main_goal flip incoherence) was a class of bug Claude
explicitly hadn't thought about: if the user fills weight=80, target=70
under `lose_weight`, then PATCHes `mainGoal=gain_weight` without
re-saving weight, the row becomes incoherent — `gain_weight` with a
*lower* target. The fix isn't validation at submit, it's validation at
PATCH against the *currently-stored* weight pair. Pure helper
`checkMainGoalChange` lives in `lib/assessment.ts` precisely so the
state-machine logic stays testable.

### Phase 4 — Day-3 calc / gate / pay

Codex's review-006 B001 was the most demanding finding: "live cookie-jar
smoke is not a regression test". Claude had verified `/submit` and
`/pay` idempotency via curl against Supabase but never committed
machine-checkable assertions. The fix required a structural refactor:
extract `SubmitTxOps` and `PaymentTxOps` interfaces, build in-memory
fakes modelling the same unique-constraint + P2002 behaviour as Prisma,
and run state-machine tests against the fakes. The pure orchestrators
(`runSubmitTransaction`, `runPaymentTransaction`) now compose the same
way in tests as in production — only the Prisma adapter differs.

I002 was a curve-rendering bug Claude would have shipped: when
`fullWeeks > MAX_CURVE_WEEKS=52`, the calculator nulled
`predictedTargetDate` (correct) but still snapped the final curve point
to the goal weight (wrong — the response then claims "no finish date,
but goal reached in 1 year"). One-line fix, dedicated boundary test at
`weightKg=250, targetWeightKg=175` (exactly 30%, not short-circuited).

### Phase 5 — Day-4 UI / deploy

Codex's review-007 caught two deployment-routing bugs that the local
test suite was structurally incapable of finding. **B001**: the
production alias `project-u415a.vercel.app/` was serving the Day-3
placeholder because `feature/frontend-funnel` hadn't been merged yet
(Owner had chosen to wait for Codex). **B002**: the preview URL was
gated by Vercel's default Deployment Protection, so an anonymous
visitor saw a SAML login screen instead of the app.

Both findings sit outside the test boundary and outside the API
contract — they're about which artifact gets served at which URL.
This is the clearest piece of evidence that Codex caught things a
single-agent loop wouldn't have: the local code was perfect, the
production *deployment* was broken, and only an out-of-process review
notices.

The substantive disagreement in this phase: Claude defaulted to "merge
to main now to fix B001". Owner overrode: keep the branch, wait for
Codex re-review, and prove the system can ship a green Preview URL.
Both got proven (preview smoke passed, then main merge resolved B001
for production).

### Phase 6 — Day-5 hardening / final review

Two real hardening fixes landed: server-side cookie TTL (T-501) and
the minimal `step_event` audit table (T-502, ADR-009 flipped from
Deferred to Accepted). The cookie TTL fix is the canonical example of
"AI catching its own hole": Claude built the cookie helper on Day 1
with `{sid, sig}` and a `Max-Age=30d` header, called it done, and only
noticed during the Day-5 hardening audit that *server-side* there's no
TTL at all. The audit phase, prompted by the task list naming the gap,
caught what the implementation phase missed.

The substantive question Codex will weigh in review-004-final: is the
`step_event` write inside the PATCH transaction worth the latency cost
for a free-tier challenge demo? Claude's answer: yes, because the
brief grades "DB extensibility" and this is the smallest possible
audit that future analytics can build on without a backfill.

What would we do differently next time: open the AI collaboration log
on Day 0 with one row per turn, instead of backfilling on Day 5.
Backfilling tempts a marketing tone; per-turn entries stay honest
because they're written when the disagreement is fresh.
