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

*(Day-1 and onward entries will be appended as work progresses.)*

## Per-phase retrospective

These short sections are filled in at the end of each phase, not per
turn. Each answers: *what AI did well, what failed, what we would do
differently*.

### Phase 0 — Scaffold *(closing this entry on Day 1 once code lands)*
### Phase 1 — Design *(in progress)*
### Phase 2 — Day-1 foundations
### Phase 3 — Day-2 funnel persistence
### Phase 4 — Day-3 calc / gate / pay
### Phase 5 — Day-4 UI / deploy
### Phase 6 — Day-5 hardening / final review
