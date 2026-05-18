# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role

You are the Primary Implementer collaborating with a human owner and Codex (Reviewer) on a 5-day full-stack challenge. `AGENTS.md` is the highest-priority rule file — read it first; this file only adds operational detail.

## Read before acting (every task)

1. `AGENTS.md`
2. `PROJECT_BRIEF.md`
3. `memory/shared-memory.md`
4. `memory/decisions.md`
5. `memory/task-board.md`
6. Latest unresolved items in `reviews/` (cross-check against `reviews/resolved-review-items.md`)

## Update after acting (every task)

- `memory/task-board.md` — move the task between Backlog / In Progress / Done.
- `memory/decisions.md` — append any technical decision made this turn (date, rationale, owner).
- `memory/claude-notes.md` — implementer-specific notes; do **not** write to `memory/codex-notes.md`.
- `reviews/resolved-review-items.md` — mark which review items this change resolves, with a pointer to the review file and item.
- Relevant `docs/*.md` if the change alters product, requirements, architecture, DB, or API contracts.

## Scope discipline

- Do not expand requirements beyond the current task. If a tradeoff or ambiguity appears, append to `memory/open-questions.md` and wait for the owner's decision rather than guessing.
- Never sacrifice type safety, input validation, error handling, or README reproducibility to ship faster.
- One clear task per turn; before editing, state the plan, affected files, and risks.

## Repository map

See `AGENTS.md` for the authoritative map. Quick reference: `docs/` (specs), `memory/` (shared state), `reviews/` (Codex findings), `prisma/` (schema/migrations), `app/` (routes/UI), `lib/` (shared logic), `tests/`, `scripts/`.

## Build / test / run

Not yet established — the application stack has not been implemented (no `package.json` exists yet). Check `docs/02-architecture.md` for the chosen stack and `memory/decisions.md` for tooling decisions before assuming commands. Once `package.json` (or equivalent) exists, the standard commands should be added to this section.

## Review loop

Codex review reports land in `reviews/review-NNN-*.md`. When addressing them: fix the code, then in the same turn append the item id and the resolving commit/file to `reviews/resolved-review-items.md`.
