# Health Funnel Challenge

A 5-day full-stack interview project: a BetterMe-style health quiz funnel
with anonymous sessions, server-side health calculation, and a mock-paid
result gate. Optimised for the four things the brief grades — API design,
DB modelling, end-to-end loop correctness, and AI collaboration — not for
UI fidelity.

## Submission info

| | |
| - | - |
| **Live demo** | https://project-u415a.vercel.app/ |
| **Source** | https://github.com/AC-Reaper/health-funnel-challenge |
| **API design** | [`docs/04-api-design.md`](docs/04-api-design.md) |
| **DB design + ER diagram** | [`docs/03-database-design.md`](docs/03-database-design.md) |
| **AI collaboration log** | [`docs/05-ai-collaboration-log.md`](docs/05-ai-collaboration-log.md) |
| **Security review** | [`docs/08-security-hardening.md`](docs/08-security-hardening.md) |
| **Prod audit** | `npm audit --omit=dev` → 0 vulnerabilities (Next.js 15.5.18 + pinned `postcss` override). |
| **Paid test sessionId** | Run `BASE=<live-url> npm run seed:demo` to mint a paid + free session and print both ids, then diff them via `GET /api/v1/results/by-session?sessionId=<id>`. See [§Paid test session](#paid-test-session). |

Want a working paid session against the live URL in ~30 seconds? Jump
to [§Paid test session](#paid-test-session) below.

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
| Frontend | Next.js 15 (App Router) + TypeScript | Same process serves UI + API; fastest path to a public demo URL. |
| Backend | Next.js route handlers + TypeScript | One repo, one deploy. |
| Validation | Zod at every API boundary | Single source of truth for runtime checks and TS types. |
| Database | PostgreSQL (Supabase Free) | Brief lists this combo; managed, free, no ops. |
| ORM / migrations | Prisma | First-class TS types; checked-in migrations. |
| Identity | Anonymous session, signed httpOnly cookie | Brief permits session/UUID; no real-auth scope creep. |
| Payment | Two paths sharing one grant primitive: the brief's secret-free mock `POST /api/v1/pay` (ADR-018), **and** a production-grade **signature-verified webhook** (ADR-017) the browser UI drives (checkout → mock provider → HMAC-signed `payments/webhook`) | Brief asks for a directly-callable `/pay` *and* a replayable cURL; both replay-safe by DB unique constraint. The webhook shows the production boundary (browser cannot mint `paid` — only a signed callback can) without a real Stripe dependency. See `docs/08-security-hardening.md` §3.6. |
| Hosting | Vercel (app) + Supabase (DB) | Free tier; public HTTPS URL out of the box; no VPS required. |

Full decision history lives in `memory/decisions.md` (ADR-001…019).

## Status

Day 1–5 features shipped + delivery-compliance + production-hardening
passes. Full funnel loop runs end-to-end against Supabase: anonymous
session → 6-step browser quiz → submit → calculator → gated teaser →
checkout → signature-verified webhook → full result; plus the brief's
secret-free mock `/pay` callback (ADR-018) for a replayable, no-secret
reproducer. 255 unit tests
green; live cookie-jar smoke covers happy + sad paths for every
endpoint; the Codex review log (`docs/06-review-log.md`) is current
through `review-016`, all Resolved; `npm audit --omit=dev` clean
(Next.js 15.5.18 + pinned `postcss` override). Production-hardening pass
adds baseline security response headers (XCTO / XFO / Referrer-Policy /
Permissions-Policy / CSP frame-ancestors), `Cache-Control: private,
no-store` on every personalised + error response, a 16 KB body-size
cap (`413 PAYLOAD_TOO_LARGE`), 512-char `User-Agent` truncation, an
optional `APP_ORIGIN` allowlist for `internalUrl()`, a
Postgres-backed best-effort rate limiter on the hot write routes
(`429 RATE_LIMITED` + `Retry-After`, ADR-016), and a two-path payment
model — the brief's secret-free mock `POST /api/v1/pay` (ADR-018) plus a
production-style signature-verified webhook the browser checkout cannot
bypass to mint `paid` (ADR-017) —
`docs/08-security-hardening.md` §3.1–§3.6 has the falsifiable
table.

## To be added (in implementation order)

| Day | What lands here |
| - | - |
| Day 1 | ✅ `package.json` + Prisma schema + first migration (`feature/db-schema`, merged). ✅ Next.js App Router skeleton (scaffolded on 14; upgraded to 15.5.18 during production-hardening, ADR-015) + `lib/session.ts` + first 3 endpoints (`feature/session-progress-api`, merged after live Supabase smoke). |
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
| `feature/day5-hardening` | 5 | `review-004-final.md` | yes |
| `feature/frontend-polish` | post-MVP | `review-008-frontend-polish.md` | yes (`24e4fbc`) |
| `feature/security-hardening` | post-MVP | `review-009-security-hardening.md` | yes (`d6d5b1c`) |

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
| `npm test` | Vitest, 255 unit tests |
| `npm run seed:demo` | Seed a paid + free demo session against `$BASE`; prints both sessionIds |
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

# 8. Create a checkout (browser-equivalent). This does NOT grant access.
curl -sS -b "$JAR" -X POST "$BASE/api/v1/payments/checkout" \
  -H "Content-Type: application/json" -d '{}' | jq   # status:"pending"
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq '.kind'   # still "teaser"

# 9. Act as the payment provider: sign a checkout.completed event and POST
#    the webhook. Entitlement is granted ONLY here (ADR-017). $SID is the
#    session UUID; read it from GET /sessions/me.
SID=$(curl -sS -b "$JAR" "$BASE/api/v1/sessions/me" | jq -r .sessionId)
PAYLOAD="{\"eventType\":\"checkout.completed\",\"sessionId\":\"$SID\",\"idempotencyKey\":\"$(uuidgen)\",\"amountCents\":999,\"currency\":\"USD\",\"status\":\"succeeded\"}"
SIG="sha256=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | sed 's/^.*= //')"
curl -sS -X POST "$BASE/api/v1/payments/webhook" \
  -H "Content-Type: application/json" -H "X-Payment-Signature: $SIG" -d "$PAYLOAD" | jq
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq '.kind'   # now "full"

# 10. Negative: the same payload with a bad signature is rejected — proof
#     the browser cannot mint `paid` without the secret.
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/payments/webhook" \
  -H "Content-Type: application/json" -H "X-Payment-Signature: sha256=deadbeef" -d "$PAYLOAD"
# → 401
```

`$PAYMENT_WEBHOOK_SECRET` must match the server's env. Locally it's in
`.env`; against the deployed URL you'd run this from an environment that
knows the secret — which is exactly the point: **only** a holder of the
secret (the payment provider) can grant entitlement.

Browser path (same flow, polished UI): visit `$BASE/`, click **Start the
quiz**, complete six steps, hit **Pay** → the mock provider page →
**Confirm payment**, land on the full plan at `$BASE/results`.

## Paid test session

There are **two** ways to get a paid session and compare the pre/post-payment
differentiated returns the brief asks for. The first needs **no secret** and
is the recommended reproducer; the second demonstrates the production-grade
signature-verified boundary.

### Fastest: seed two sessions, then diff them

```bash
BASE="https://project-u415a.vercel.app" npm run seed:demo
# prints a PAID and a FREE sessionId, e.g.:
#   PAID (full):   3f1c…  →  $BASE/api/v1/results/by-session?sessionId=3f1c…
#   FREE (teaser): 9a02…  →  $BASE/api/v1/results/by-session?sessionId=9a02…
```

`GET /api/v1/results/by-session?sessionId=<id>` is a **demo-only** read
(no cookie, no secret) that returns the *same* leak-tested serializers as
`/results/me` — `kind:"full"` for the paid id, `kind:"teaser"` for the
free one — so a reviewer can diff them directly. It only reads
**seeded demo sessions** (ADR-019): a real visitor's session id returns
404, so this is not a back door into anyone's data — the cookie stays the
real credential.

```bash
curl -sS "$BASE/api/v1/results/by-session?sessionId=<PAID>" | jq '.kind'   # "full"
curl -sS "$BASE/api/v1/results/by-session?sessionId=<FREE>" | jq '.kind'   # "teaser"
```

### Manual: replayable `/pay` cURL (no secret)

The brief's mock callback. Walk the funnel with a cookie jar, then `POST
/api/v1/pay` with an `Idempotency-Key` to flip `entitlement_status` to
`paid`:

```bash
BASE="https://project-u415a.vercel.app"   # or http://localhost:3000
JAR="$(mktemp)"

# 1. Anonymous session (Set-Cookie hfc_session)
curl -sS -c "$JAR" -b "$JAR" -X POST "$BASE/api/v1/sessions" \
  -H 'Content-Type: application/json' -d '{}' > /dev/null

# 2. Six steps (gender → main_goal → age → height → weight → activity)
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
    -H 'Content-Type: application/json' -d "$payload" > /dev/null
done

# 3. Submit
curl -sS -b "$JAR" -X POST "$BASE/api/v1/sessions/me/submit" \
  -H 'Content-Type: application/json' -d '{}' > /dev/null

# 4. Teaser before paying
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq '.kind'   # "teaser"

# 5. Mock pay (replay-safe under the same Idempotency-Key). Flips paid.
curl -sS -b "$JAR" -X POST "$BASE/api/v1/pay" \
  -H 'Content-Type: application/json' -H "Idempotency-Key: $(uuidgen)" \
  -d '{}' | jq '{sessionId, paymentId, entitlementStatus}'

# 6. Full result after paying
curl -sS -b "$JAR" "$BASE/api/v1/results/me" | jq '.kind'   # "full"
```

### Production-pattern variant: signature-verified webhook (needs the secret)

`/pay` above is the brief's *mock*. In production, entitlement should be
granted only by a signed provider callback — which is exactly what the
browser UI drives (`/pay` page → `payments/checkout` → mock-provider page
→ webhook, ADR-017). To exercise that path headlessly, set
`PAYMENT_WEBHOOK_SECRET` to match the server env and replace steps 4–6
above with:

```bash
# Create a checkout (browser step — cannot grant access on its own)
curl -sS -b "$JAR" -X POST "$BASE/api/v1/payments/checkout" \
  -H 'Content-Type: application/json' -d '{}' | jq '{sessionId, status}'

# Act as the provider: sign + POST the webhook (the ONLY grant path here).
SID=$(curl -sS -b "$JAR" "$BASE/api/v1/sessions/me" | jq -r .sessionId)
PAYLOAD="{\"eventType\":\"checkout.completed\",\"sessionId\":\"$SID\",\"idempotencyKey\":\"$(uuidgen)\",\"amountCents\":999,\"currency\":\"USD\",\"status\":\"succeeded\"}"
SIG="sha256=$(printf '%s' "$PAYLOAD" | openssl dgst -sha256 -hmac "$PAYMENT_WEBHOOK_SECRET" | sed 's/^.*= //')"
curl -sS -X POST "$BASE/api/v1/payments/webhook" \
  -H 'Content-Type: application/json' -H "X-Payment-Signature: $SIG" -d "$PAYLOAD" \
  | jq '{sessionId, paymentId, entitlementStatus}'

# Negative: a bad signature is rejected → 401 (browser cannot mint paid).
curl -sS -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/v1/payments/webhook" \
  -H 'Content-Type: application/json' -H 'X-Payment-Signature: sha256=deadbeef' -d "$PAYLOAD"
```

**On the auth model.** The `sessionId` is the row identifier; the real
auth credential is the signed httpOnly cookie carried via `$JAR`. The
`/results/me` read returns `401 NO_SESSION` without it:

```bash
curl -sS "$BASE/api/v1/sessions/me"   # no -b "$JAR"
# → {"error":{"code":"NO_SESSION", ...}}
```

`GET /results/by-session` is the one endpoint that accepts a bare
`sessionId` — a deliberately-scoped, read-only **demo aid** for §五-1c. It
exposes nothing `/results/me` doesn't (same serializers), and it only
reads **demo-seeded sessions** (those created by `seed:demo` with a marker
User-Agent, ADR-019): a real visitor's session id returns 404, so a
leaked/guessed UUID is not bearer read-access to their data.

See [`docs/04-api-design.md`](docs/04-api-design.md) §Authentication
and [`docs/08-security-hardening.md`](docs/08-security-hardening.md) §2
for the HMAC + iat TTL + same-origin guard design.

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

## Submission email template

```
To: yitengruntu12123@gmail.com, alex@arkon-tech.com, rip@arkon-tech.com
Subject: 【姓名】_全栈挑战_20260520

各位老师好，

提交全栈挑战的最终交付，重点信息如下：

• 在线 demo:   https://project-u415a.vercel.app/
• 源码:        https://github.com/AC-Reaper/health-funnel-challenge
• API 文档:    docs/04-api-design.md
• DB 设计:     docs/03-database-design.md
• 安全审阅:    docs/08-security-hardening.md
• AI 协作记录: docs/05-ai-collaboration-log.md

README 顶部的「Submission info」+「Demo path」可以一次性走完六步、
完成 mock 支付、看到 full result。如果只想直接复现一个 paid
sessionId，复制 README §Paid test session 的 cURL 段落即可
（脚本会输出 sessionId / paymentId / entitlementStatus）。

技术摘要：
• Next.js 15 App Router + TypeScript + Zod + Prisma + Postgres
  (Supabase) + Vercel.
• 匿名 session、HMAC-signed httpOnly cookie、server-side TTL。
• 10 个 /api/v1 路由，全部 Zod 校验。
• 255 个 vitest 单元；Codex 评审记录截至 review-016 全部 Resolved；`npm audit --omit=dev` 干净。
• 评审记录: docs/06-review-log.md。

期待反馈。
```
