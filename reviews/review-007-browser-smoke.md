# Review 007: Deployed Browser Smoke

## Status

Open — 2026-05-19

Preview deployment smoke passed on 2026-05-19 after Vercel protection was
removed. The review remains Open only because the production alias
`https://project-u415a.vercel.app/` was previously observed serving the
old placeholder and has not yet been re-verified as the final public URL.

Deployments reviewed:
- `https://project-u415a.vercel.app/`
- `https://project-u415a-oafjf8eba-jackz1.vercel.app/`

Branch context: local `feature/frontend-funnel` at `0a38880`

Scope reviewed:
- Public browser entry at `/`
- No-cookie browser access to `/pay`
- Direct probes for `/results`, `/funnel`, `/quiz`, `/assessment`
- Requested full flow: start quiz → 6 steps → `/results` → unlock → `/pay` → Pay → full result

Verification run:
- Browser smoke against `https://project-u415a.vercel.app/`
- Cache-busted root load: `/?codex_smoke=<timestamp>`
- DOM check for exact `Start the quiz` button/link

## Overall Assessment

The deployed URL is not serving the Day-4 funnel UI. It still shows the
old placeholder page: "Server is up. The funnel UI lands in a later
branch (`feature/frontend-funnel`)." The requested full browser loop
cannot start because there is no `Start the quiz` CTA, and `/funnel`
returns the Next.js 404 page on the public deployment.

This is a deployment/release blocker, not evidence that the local branch
implementation is broken. The local `feature/frontend-funnel` code does
contain the landing CTA, `/funnel`, `/pay`, and `/results` pages, so the
most likely issue is that Vercel production is still pointed at an older
deployment or the wrong branch/commit.

## Smoke Results

| Path | Observed result | Expected result | Status |
| - | - | - | - |
| `/` | Placeholder page, no `Start the quiz` button or link | Landing page with `Start the quiz` CTA | Fail |
| `/?codex_smoke=<timestamp>` | Same placeholder page | Same current landing page, cache bypassed | Fail |
| `/pay` with no session cookie | Redirects to `/` | Redirects to `/` | Pass |
| `/results` with no session cookie | Redirects to `/` | Redirects to `/` | Pass |
| `/funnel` | 404 | Server-bootstrapped funnel stepper | Fail |
| `/quiz` | 404 | Not a documented route | Informational |
| `/assessment` | 404 | Not a documented route | Informational |

The second requested path ("start a funnel, complete two steps, direct
visit `/pay`, see `Finish the quiz first`") could not be exercised on the
deployment because `/funnel` is unavailable and the root CTA is missing.

## Blocking

### B001 — Production URL serves the pre-frontend placeholder instead of the Day-4 funnel UI

- Impact range: public demo URL, Day-4 T-401/T-402/T-404 acceptance, README browser path, final evaluator first impression, end-to-end browser proof.
- Risk reason: The challenge is scored on a public end-to-end demo. A reviewer visiting the submitted URL cannot click `Start the quiz`, cannot complete the six-step funnel, cannot reach the teaser result, and cannot verify the mock payment closeout. This can fail the challenge even if the local branch is correct because the deliverable is the deployed product.
- Suggested fix: Deploy the current `feature/frontend-funnel` commit, or merge it to `main` and trigger a fresh production deployment. Confirm Vercel is building commit `0a38880` or later, with `DATABASE_URL`, `DIRECT_URL`, and `SESSION_COOKIE_SECRET` set for the deployed environment. Re-run the requested browser smoke from a fresh browser context: `/` → `Start the quiz` → six steps → `/results` teaser → unlock → `/pay` → Pay → full result.

## Important

None.

## Nice-to-have

None.

## Re-smoke — 2026-05-19 Preview Deployment

Deployment reviewed: `https://project-u415a-oafjf8eba-jackz1.vercel.app/`

Verification run:
- Browser opened `/pay?codex_no_cookie=<timestamp>`
- Browser opened `/?codex_root=<timestamp>`
- Screenshot captured of the resulting page

Observed result:
Both paths redirect to Vercel login:

```text
https://vercel.com/login?next=/sso-api?url=https%3A%2F%2Fproject-u415a-oafjf8eba-jackz1.vercel.app%2F...
```

The page shown is `Log in to Vercel`, with email / Google / GitHub /
Apple / SAML / passkey login options. The application itself never loads,
so the requested browser flow cannot be exercised.

### Blocking

#### B002 — Preview deployment is protected by Vercel login

- Impact range: public demo URL, evaluator access, all browser acceptance paths, final README demo link.
- Risk reason: A no-auth interview challenge URL must be publicly accessible. If the evaluator opens this preview URL, they see Vercel's login screen instead of the product. That prevents verifying `Start the quiz`, `/funnel`, `/results`, `/pay`, and the full result unlock, regardless of whether the underlying app code is correct.
- Suggested fix: Disable Vercel Deployment Protection for the submitted deployment, promote this build to an unprotected production deployment, or provide a public bypass URL/token if the platform workflow requires protection. Then re-run the full browser smoke from a fresh browser context: `/` → `Start the quiz` → six steps → `/results` teaser → unlock → `/pay` → Pay → full result; separately verify no-cookie `/pay` redirects to `/`, and two-step incomplete sessions see `Finish the quiz first`.

## Re-smoke — 2026-05-19 Preview Deployment After Protection Removed

Deployment reviewed: `https://project-u415a-oafjf8eba-jackz1.vercel.app/`

Verification run:
- Browser opened `/` with no app session cookie: landing page loaded with
  `Start the quiz`.
- Browser opened `/pay` before creating a session: redirected back to `/`.
- Browser clicked `Start the quiz`, selected `Female`, selected
  `Lose weight ~0.5 kg / week deficit`, then directly opened `/pay`:
  page showed `Finish the quiz first` with `Continue the quiz` CTA.
- Browser continued the same session through age `29`, height `168`,
  current weight `80`, goal weight `70`, and activity `Moderate`.
- Browser clicked `See my plan`: app navigated to `/results` teaser with
  `BMI 28.34 (overweight)` and `Unlock for 9.99 USD`.
- Browser clicked unlock: app navigated to `/pay` with `Pay $9.99`.
- Browser clicked `Pay $9.99`: app navigated back to `/results` full
  result showing `Daily calorie target 1893 kcal`, predicted finish date
  `2026-10-06`, weekly curve, and `Algorithm version: v1.0.0-mifflin`.

Smoke results:

| Path / action | Observed result | Expected result | Status |
| - | - | - | - |
| `/` before app session | Landing page with `Start the quiz` | Public landing page | Pass |
| `/pay` before app session | Redirected to `/` | Redirect to `/` | Pass |
| Two-step incomplete session → `/pay` | `Finish the quiz first` CTA | Block payment until submit | Pass |
| Six-step submit | Auto-navigated to `/results` teaser | Teaser result | Pass |
| Teaser unlock | Navigated to `/pay` | Pay page | Pass |
| Pay button | Returned to `/results` full result | Full paid result | Pass |

Blocking update:
- B002 is resolved for the preview deployment. Vercel protection no
  longer blocks anonymous access to this URL.
- B001 remains open only if `https://project-u415a.vercel.app/` is still
  the intended final submitted URL. If the preview URL above is the
  submitted demo link, the browser smoke is clear from the reviewer
  perspective.

Important:
None.

Nice-to-have:
None.
