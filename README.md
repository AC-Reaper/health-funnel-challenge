# Health Funnel Challenge

A 5-day full-stack interview project: a BetterMe-style health quiz funnel
with anonymous sessions, server-side health calculation, and a mock-paid
result gate. Optimised for the four things the brief grades — API design,
DB modelling, end-to-end loop correctness, and AI collaboration — not for
UI fidelity.

## Project goal

Deliver a public, end-to-end demo where a visitor can complete a 6-step
health funnel, see a teaser result, hit a mock `/pay`, and see the
full personalised plan. The backend must enforce the paywall server-side,
persist partial progress across refreshes, and replay-safely handle
double-clicks on submit and pay.

See `PROJECT_BRIEF.md` for the scoring criteria and MVP boundary, and
`docs/02-architecture.md` for the full technical design.

## Tech stack

| Layer | Choice | Why (short version) |
| - | - | - |
| Frontend | Next.js 14 (App Router) + TypeScript | Same process serves UI + API; fastest path to a public demo URL. |
| Backend | Next.js route handlers + TypeScript | One repo, one deploy. |
| Validation | Zod at every API boundary | Single source of truth for runtime checks and TS types. |
| Database | PostgreSQL (Supabase Free) | Brief lists this combo; managed, free, no ops. |
| ORM / migrations | Prisma | First-class TS types; checked-in migrations. |
| Identity | Anonymous session, signed httpOnly cookie | Brief permits session/UUID; no real-auth scope creep. |
| Payment | Fully mocked `POST /api/v1/pay` with `Idempotency-Key` | Brief asks for mock; replay-safe by DB unique constraint. |
| Hosting | Vercel (app) + Supabase (DB) | Free tier; public HTTPS URL out of the box; no VPS required. |

Full decision history lives in `memory/decisions.md` (ADR-001…014).

## Status

Day 1–5 features shipped. Full funnel loop runs end-to-end against
Supabase: anonymous session → 6-step browser quiz → submit → calculator
→ gated teaser → mock `/pay` → full result. 181 unit tests green; live
cookie-jar smoke covers happy + sad paths for every endpoint; Codex
review-007 verified the deployed browser flow.

## To be added (in implementation order)

| Day | What lands here |
| - | - |
| Day 1 | ✅ `package.json` + Prisma schema + first migration (`feature/db-schema`, merged). ✅ Next.js 14 App Router skeleton + `lib/session.ts` + first 3 endpoints (`feature/session-progress-api`, merged after live Supabase smoke). |
| Day 2 | ✅ Zod step schemas + `PATCH /api/v1/sessions/me/steps/:stepKey` with first-incomplete-step + weight-coherence rules + vitest with 108 unit tests (`feature/funnel-persistence-api`, merged). |
| Day 3 | ✅ Pure health calculator (`lib/health/calculator.ts`) + `POST /api/v1/sessions/me/submit` + two-serializer `GET /api/v1/results/me` (leak-tested) + mock `POST /api/v1/pay` with `Idempotency-Key` + minimal `/pay` and `/results` browser pages (`feature/assessment-result-api`, merged after review-006 closeout). |
| Day 4 | ✅ Polished funnel UI (`/funnel` server-bootstrapped stepper, Tailwind), `/pay` UX gate on `GET /results/me` (closes review-006 N003), `/results` restyle, Vercel + Supabase deploy, cookie-jar cURL walkthrough below (`feature/frontend-funnel`). |
| Day 5 | ✅ Server-side cookie TTL (`iat` + 30d expiry), `step_event` minimal audit table (ADR-009 Accepted), schema diagram refreshed, AI collaboration log filled, Codex final review (`feature/day5-hardening`). |

## Code management

Feature work branches from `main`; Claude implements, Codex reviews,
Claude fixes adopted findings, then the branch merges back to `main`
(`--no-ff`, ADR-011). Branches actually shipped, in order:

| Branch | Day | Codex review | Merged |
| - | - | - | - |
| `feature/db-schema` | 1 | `review-003-db.md` | yes (`2a56382`) |
| `feature/session-progress-api` | 1 | `review-002-api.md` (API surface) | yes (`0bda115`) |
| `feature/funnel-persistence-api` | 2 | `review-002-api.md` (step-API surface) | yes |
| `feature/assessment-result-api` | 3 | `review-006-day3.md` | yes (`e733831`) |
| `feature/frontend-funnel` | 4 | `review-007-browser-smoke.md` | yes (`814b929`) |
| `feature/day5-hardening` | 5 | `review-004-final.md` | pending re-review |

Commit messages use Conventional Commits, for example
`feat: implement anonymous session api` or
`docs: add api examples and paid session instructions`.

## Setup

```bash
# 1. Clone + install
git clone <repo-url> && cd health-funnel-challenge
npm install

# 2. Env vars
cp .env.example .env
# DATABASE_URL  — Supabase pooled URL (port 6543) with
#                 ?pgbouncer=true&connection_limit=1
# DIRECT_URL    — Supabase direct URL (port 5432); used by Prisma migrations
# SESSION_COOKIE_SECRET — 32+ bytes; openssl rand -base64 48

# 3. Generate Prisma client + apply migrations (DIRECT_URL must reach Postgres)
npm run db:generate
npm run db:deploy

# 4. Dev server
npm run dev   # http://localhost:3000
```

| Command | What it does |
| - | - |
| `npm run dev` | Next dev server on :3000 |
| `npm run build` | `prisma generate` + `next build` (used on Vercel) |
| `npm run start` | Production server (after `npm run build`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, 181 unit tests |
| `npm run db:deploy` | `prisma migrate deploy` against `DIRECT_URL` |

Node 20 LTS is pinned via `.nvmrc`.

## Deploy (Vercel + Supabase)

1. **Provision Supabase**: create a project, copy the pooled connection
   string (Connection pooling → Transaction mode, port 6543) into
   `DATABASE_URL`, and the direct connection string (port 5432) into
   `DIRECT_URL`. URL-encode any special chars in the password
   (`/` → `%2F`).
2. **Apply migrations**: `npm run db:deploy` from a local machine that
   can reach `DIRECT_URL`. Vercel's build does **not** run migrations.
3. **Create Vercel project**: import the repo; framework preset
   `Next.js` (auto). Leave Build/Install commands at defaults.
4. **Set env vars in Vercel**: `DATABASE_URL` (pooled, with the
   `?pgbouncer=true&connection_limit=1` query string), `DIRECT_URL`
   (direct), `SESSION_COOKIE_SECRET` (≥ 32 chars). Set them for the
   `Production` environment (and `Preview` if previewing PRs).
5. **Deploy**. After the first deploy succeeds, visit the URL; the
   `Set-Cookie` for `hfc_session` should include `Secure; HttpOnly;
   SameSite=Lax` (`lib/session.ts` toggles `Secure` on `NODE_ENV ===
   "production"`, which Vercel sets at runtime).

## Demo path (cookie-jar cURL walkthrough)

Reproduces the full loop end-to-end against `$BASE` (set to
`http://localhost:3000` or your deployed URL). Uses one cookie jar so
the signed `hfc_session` carries the same session id across every
request.

```bash
BASE="http://localhost:3000"   # or your Vercel URL
JAR="$(mktemp)"

# 1. Liveness check
curl -sS "$BASE/api/v1/healthz" | jq

# 2. Create an anonymous session — Set-Cookie writes hfc_session=...
curl -sS -c "$JAR" -b "$JAR" -X POST "$BASE/api/v1/sessions" \
  -H "Content-Type: application/json" -d '{}' | jq
grep hfc_session "$JAR"

# 3. Resume the session — currentStep === "gender"
curl -sS -b "$JAR" "$BASE/api/v1/sessions/me" | jq

# 4. Walk all six steps. currentStep advances to "main_goal", "age",
#    "height", "weight", "activity" between calls.
for body in \
  '{"stepKey":"gender","body":{"gender":"female"}}' \
  '{"stepKey":"main_goal","body":{"mainGoal":"lose_weight"}}' \
  '{"stepKey":"age","body":{"ageYears":29}}' \
  '{"stepKey":"height","body":{"heightCm":168}}' \
  '{"stepKey":"weight","body":{"weightKg":80,"targetWeightKg":70}}' \
  '{"stepKey":"activity","body":{"activityLevel":"moderate"}}'
do
  step=$(echo "$body" | jq -r .stepKey)
  payload=$(echo "$body" | jq -c .body)
  curl -sS -b "$JAR" -X PATCH "$BASE/api/v1/sessions/me/steps/$step" \
    -H "Content-Type: application/json" -d "$payload" | jq '.currentStep, .answers'
done

# 5. Sad path: ask for results BEFORE submit — 409 NOT_SUBMITTED
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq

# 6. Submit. Idempotent on session_id UNIQUE: a second call returns the
#    same payload and never inserts a second row.
curl -sS -b "$JAR" -X POST "$BASE/api/v1/sessions/me/submit" \
  -H "Content-Type: application/json" -d '{}' | jq

# 7. Teaser: GET /results/me returns kind="teaser" with bmi + headline.
#    Note no dailyCaloriesKcal / predictedTargetDate / curvePoints /
#    plan / algorithmVersion fields are present — leak-tested.
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq

# 8. Mock pay with an Idempotency-Key. Replay returns the same row.
#    A new key on a paid session is a silent no-op (ADR-012).
KEY=$(uuidgen)
curl -sS -b "$JAR" -X POST "$BASE/api/v1/pay" \
  -H "Content-Type: application/json" -H "Idempotency-Key: $KEY" -d '{}' | jq
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq   # now kind="full"
```

Browser path (same flow, polished UI): visit `$BASE/`, click **Start the
quiz**, complete six steps, hit **Pay**, land on the full plan at
`$BASE/results`.

## Edge cases verified (T-501)

Six failure / replay paths the brief calls out, each pinned to the
artefact that locks it. No box is ticked on live smoke alone — every
case has a committed test or a documented DB invariant.

| Case | Verified by |
| - | - |
| Refresh mid-step (resume from first incomplete) | `lib/progress.ts::computeCurrentStep` + `tests/lib/progress.test.ts` + server-bootstrapped `/funnel` page (`app/funnel/page.tsx`) |
| Double-submit (same session POSTs `/submit` twice) | `tests/lib/result-repo.test.ts` "idempotent replay" + DB `UNIQUE result.session_id` |
| Double-pay same `Idempotency-Key` | `tests/lib/payment.test.ts` "idempotent same-key replay" + DB `UNIQUE payment(session_id, idempotency_key)` |
| Already-paid + new `Idempotency-Key` (silent no-op, ADR-012) | `tests/lib/payment.test.ts` "already-paid + NEW key → silent no-op" + DB partial unique index `payment_one_success_per_session_idx` |
| Tampered cookie (bit-flip / swapped `sid`) | `tests/lib/session.test.ts` "rejects a tampered signature" + "rejects a signature valid for a different sid" |
| **Expired cookie** (server-side TTL, T-501) | `tests/lib/session.test.ts` "verifyCookie TTL" — 6 cases including 1-second-past-30d, future-dated `iat`, missing `iat`, tampered `iat` |

The Day-5 cookie change adds an `iat` (issued-at unix seconds) to the
signed payload; `verifyCookie` enforces `now - iat < 30d` with a 60-
second clock-skew tolerance. The HMAC commits to both `sid` and `iat`,
so `iat` cannot be tampered without invalidating the signature.
Existing prod cookies issued before Day 5 are rejected and the next
PATCH/GET triggers a fresh `POST /api/v1/sessions` — invisible to the
end user.

## Documentation

- `PROJECT_BRIEF.md` — scoring criteria, MVP boundary.
- `AGENTS.md` — roles, collaboration rules, memory maintenance.
- `docs/02-architecture.md` — full technical design (v2).
- `docs/04-api-design.md` — endpoint contracts, error model.
- `docs/03-database-design.md` — Prisma schema (Day 1).
- `docs/05-ai-collaboration-log.md` — how Claude/Codex were used per phase.
- `docs/08-security-hardening.md` — attack surface, existing controls, test proof table, out-of-scope.
- `memory/decisions.md` — ADR log.
- `memory/task-board.md` — live task tracker.
