# Open Questions

## Q-001: Sign-off on ADR-001…010

Status: Resolved (2026-05-18)

Decision:
Owner accepted ADR-001…010 in `memory/decisions.md`. Day 1 may start with T-101.

Reason:
The full stack, identity model, payment shape, entitlement model, step-progress rule, and demo-path approach are all locked in. Implementation can proceed without further decision risk.

## Q-002: Demo copy language

Status: Resolved (2026-05-18)

Decision:
Use English for the first demo. Chinese can be added later as a copy-only
follow-up if time remains.

Reason:
English is enough for the initial challenge delivery and avoids spending
Day 1–4 time on i18n or duplicated copy.

## Q-003: Calorie-target formula

Status: Resolved (2026-05-18)

Decision:
Use the proposed default: Mifflin-St Jeor BMR multiplied by activity factor,
with a 500 kcal/day deficit for weight loss, 300 kcal/day surplus for gain,
and floors of 1200 kcal/day (female) and 1500 kcal/day (male).

Reason:
The formula is explainable, deterministic, fixture-testable, and sufficient
for the interview challenge.

## Q-004: "Paid" semantics

Status: Resolved (2026-05-18)

Decision:
Lifetime entitlement. `paid` is a terminal state on `session.entitlement_status`. No expiry, no recurring billing concepts in MVP.

Reason:
Collapsed into ADR-007 — a one-time mock payment does not need a recurring entitlement state machine.

## Q-005: Pre-seeded paid `sessionId` shape

Status: Resolved (2026-05-18)

Decision:
Dropped. No pre-seeded paid session. The README ships a cookie-jar cURL walkthrough that creates, submits, pays, and reads in the evaluator's own session.

Reason:
Cookie-only auth (ADR-004) makes a bare DB UUID un-callable from outside a browser. Codified as ADR-010.

## Q-006: `POST /api/v1/pay` against an already-paid session with a new `Idempotency-Key`

Status: Resolved (2026-05-18)

Decision:
Choose B. If a session is already paid and `/api/v1/pay` receives a new
`Idempotency-Key`, silently no-op: return `200 OK` with the existing paid
entitlement and do not insert a second `payment` row.

Reason:
This is friendlier for repeated evaluator runs, double-clicks, and browser
retries. The mock payment flow remains idempotent and the entitlement stays
server-trusted.

Tradeoff:
Option A (`409 ALREADY_PAID`) would make accidental duplicate payment
attempts louder and easier to catch in logs/tests. For this challenge,
Owner prefers the quieter UX of B.
