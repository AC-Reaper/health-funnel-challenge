# 01 — Requirements

> **Purpose.** The testable functional + non-functional spec the
> implementation will be measured against. Each requirement has an id
> (`R-NNN`) so reviews and tests can reference it.
>
> **Owner.** Claude. Drafted Day 1 from `PROJECT_BRIEF.md` and
> `00-product-research.md`. Changes after Day 1 require an ADR.
>
> **Day-1 guidance.** Keep this short and testable. Each requirement is
> one line of "the system shall …" plus an acceptance test. No prose
> product analysis — that belongs in `00`. Aim for ~10 functional
> requirements, not 50.

## 1. Functional requirements

*(To be filled in Day 1.)*

| ID | Requirement | Source | Acceptance test |
| - | - | - | - |
| R-001 | *e.g.* The funnel must persist each step on completion so the user can resume after refresh. | Brief §三.1 | Refresh after step 3, GET /sessions/me returns first-incomplete = step 4 with steps 1–3 populated. |

## 2. Non-functional requirements

*(To be filled in Day 1. Cover: validation strictness, idempotency
guarantees, latency target on demo URL, single-device session scope,
algorithm determinism / versioning.)*

## 3. User stories

*(To be filled in Day 1. Short, one-line user stories grouped by
funnel phase: discovery, funnel, submit/result, paywall, post-pay.)*

## 4. Acceptance criteria summary

The "Definition of Done" in `PROJECT_BRIEF.md` §6 is the canonical
acceptance list for the project as a whole. This section restates them
per requirement once R-NNN ids exist.

## 5. Out of scope

See `docs/02-architecture.md` §9 ("What we are deliberately not
doing"). Items there are out of MVP scope by design, with rationale.
