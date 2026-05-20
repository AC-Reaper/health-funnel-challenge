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

## Q-007: Explicit "Start over" / restart after a submitted session

Status: Deferred (2026-05-20, post-MVP)

Context:
The landing CTA was relabelled to be state-aware (Q-007 prompted by a
tester report — a returning submitted session was shown a misleading
"Start the quiz"). The state-aware CTA shipped on `feature/landing-cta`;
an explicit **restart** (let a submitted visitor begin a fresh quiz)
was considered and deferred.

Decision:
Do not build restart for the delivered demo. The state-aware CTA
("Start" / "Continue" / "View your results") resolves the reported
UX mismatch on its own.

Reason / analysis:
- The DB-flood worry that motivated the discussion is the **cookieless**
  `POST /api/v1/sessions` (unbounded anonymous rows). That vector
  already exists and its real control is rate limiting, which is
  deferred and documented in `docs/08-security-hardening.md` §5
  (Upstash / Vercel KV, throttle `/sessions` first). No restart design
  closes it.
- Two restart designs were weighed:
  - **Reset-in-place** — reuse the same session id, wipe assessment +
    delete the `result`, back to `draft`. Zero new rows (flood-safe for
    a cookie-holder), but destroys that session's immutable `result`
    snapshot.
  - **`visitor` model** — new `visitor` table, `session.visitor_id`,
    partial unique index `one_active_draft_per_visitor`, transactional
    `/restart`, cookie points to visitor. Preserves prior
    `submitted`/`result`/`payment` while allowing a new attempt; the
    index bounds drafts **per identified visitor** (does not stop
    new-visitor spam). This is the architecturally correct production
    shape and the **ADR-016 candidate** if revived. It also un-collapses
    the `User → session` mapping recorded in `docs/03` §2.1.
- For a delivered, live, 5-day interview demo, a 5th table + migration +
  cookie/identity change (touching ADR-004) is disproportionate to a
  UX-label report. Logged here rather than built.

If revived:
Implement the `visitor` model on a fresh branch as ADR-016, with a
Codex review, and reconcile `docs/03` §2.1 + ADR-004/007.
