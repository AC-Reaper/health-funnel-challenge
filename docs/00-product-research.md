# 00 — Product Research

> **Purpose.** Capture what we learned from the reference competitor
> (BetterMe Pilates Quiz Funnel) and any other product references. This
> doc grounds the requirements in `01-requirements.md` and the scope
> decisions in `02-architecture.md`. Not a feature wishlist — only
> observations that change a design decision belong here.
>
> **Owner.** Claude. Filled by Codex on 2026-05-20 from a live browser
> walkthrough of the reference flow.
>
> **Status.** Current for the submitted MVP. The BetterMe flow is
> dynamic and may vary by region/device/experiment; observations below
> are the concrete screens seen on 2026-05-20.

## 1. Reference product

- Name: BetterMe Pilates Quiz Funnel
- URL: https://betterme-pilates.com/first-page-brand-palette?flow=2117
- Why we look at it: the brief asks us to model the **data flow**:
  which steps produce which data, which data must survive refresh, and
  what changes before vs after payment. UI fidelity is not the goal.
- Walkthrough boundary: progressed from age selection through the
  generated-plan/email capture screen. No real email, account creation,
  or payment was submitted.

## 2. Funnel steps observed

### Entry and trust-building

- Entry starts with an age-range choice (`18-29`, `30-39`, `40-49`,
  `50+`) and a "1-minute quiz" promise.
- The first post-entry screen uses social proof ("Over 10 million
  people have chosen BetterMe") before asking more questions.
- Interstitial trust screens appear between data-heavy sections, e.g.
  "Lose weight easily with Pilates for Beginners", "Burn belly fat and
  tone your whole body", "Relieve body tension after a long day", and
  a progress-style "Creating your Pilates Plan" screen with reviews.

### Profile / body-goal data

- Main goal: lose weight, increase muscle strength, develop flexibility,
  reduce stress/worry, improve posture.
- Physical build: slim, mid-sized, plus-sized, significantly overweight.
- Desired body: thin, toned, curvy, average.
- Weight-change tendency: hard to gain, gain/lose easily, gain fast and
  lose slowly.
- Best-shape recency: less than a year ago, 1-2 years ago, more than 3
  years ago, never.

### Activity and limitations

- Pilates experience: just starting out, some experience, proficient.
- Target zones: belly, butt, legs, chest; multi-select.
- Flexibility self-assessment.
- Breathlessness on stairs as a proxy for cardio/fitness level.
- Sensitive back/knees/none as a limitation screen.
- Exercise frequency and walking frequency.

### Lifestyle / habits / nutrition

- Work schedule and typical day, especially sitting vs active breaks vs
  on-feet-all-day.
- Energy levels, water intake, sleep duration.
- Meal timing for breakfast/lunch/dinner.
- Diet preference: traditional, keto, paleo, vegetarian, vegan,
  Mediterranean, pescatarian, lactose-free, gluten-free.
- Bad habits: late-night eating, sugar, soda, too much salt, none.
- Life events associated with weight gain: relationship, busy work/family
  life, financial struggles, stress/worry, slower metabolism, none.

### Measurements and generated preview

- Height, current weight, goal weight, and exact age are collected near
  the end.
- On the height screen, BetterMe explicitly asks for consent to process
  "health onboarding data".
- Current weight immediately produces a BMI explanation.
- Goal weight produces a "realistic goal" message and cites a safe
  monthly loss rate.
- A pre-payment "wellness profile" shows BMI, body type, lifestyle,
  fitness level, and metabolism.
- A later preview shows a target weight/date and an illustrative weight
  curve, then transitions to a generated-plan/email capture screen.

## 3. Data we infer is persisted

### Must persist for resume

- Anonymous visitor/session identity.
- Current step/progress.
- Every completed step answer, because the flow is long and the user
  can abandon mid-way.
- Multi-select answers as arrays or event rows if analytics are needed.

### Must persist for result computation

- Core body metrics: age, height, current weight, target weight.
- Goal: lose, maintain, gain/build muscle.
- Activity level, derived from exercise frequency, walking frequency,
  day activity, and fitness proxies.
- Optional product-marketing dimensions (target zones, flexibility,
  meal timing, habits) can personalise copy, but are not required for
  the challenge's BMI/calorie/date algorithm.

### Must persist for gating

- Submission state: whether the assessment has been completed and a
  result snapshot exists.
- Entitlement/subscription state: free vs paid.
- Payment audit/idempotency data: payment id, idempotency key, amount,
  currency, status, timestamp.
- Result snapshot and algorithm version, so paid access returns the
  same computed result after refresh or replay.

## 4. Pre-paywall vs post-paywall surface

- BetterMe shows meaningful free previews before payment/email capture:
  BMI, qualitative profile attributes, target weight/date, an
  illustrative curve, testimonials, and "plan ready" framing.
- The actionable plan is held back after lead capture/subscription.
  In the observed walkthrough, the flow reached an email gate before
  any final paid plan or checkout step.
- For our MVP, the same pattern maps to:
  - **Free teaser:** BMI, BMI category, short headline, and locked
    preview cards for paid-only fields.
  - **Paid full result:** daily calories, predicted target date, weekly
    curve points, plan narrative, and `algorithmVersion`.
- Design implication: the free response must be structurally incapable
  of leaking paid fields, not merely hidden in the UI. This is why
  `lib/serializers/result.ts` has separate teaser/full DTOs and a leak
  test.

## 5. Decisions we make differently, and why

- **Shorter funnel.** BetterMe uses a long persuasion funnel. The brief
  grades engineering spine, so our MVP keeps six core steps:
  `gender -> main_goal -> age -> height -> weight -> activity`. This
  preserves the computation and resume requirements without storing
  low-signal marketing answers.
- **Gender is explicit in our flow.** The observed Pilates flow did not
  ask gender in this path; it appears product-positioned. Our calculator
  uses Mifflin-St Jeor, so gender is required for deterministic calorie
  estimates.
- **No email lead capture.** BetterMe gates the generated plan behind
  email before final subscription. The challenge permits session/UUID
  identity and values a reproducible demo, so we use a signed httpOnly
  cookie instead of email/auth.
- **Server-side entitlement, not UI-only lock.** BetterMe's front end
  can visually blur/withhold plan detail, but the scored challenge is
  API gating. Our `/api/v1/results/me` branches server-side on
  `session.entitlement_status`.
- **Mock payment with real idempotency semantics.** The reference is a
  real subscription funnel; the brief asks for mock `/pay`. We mimic
  payment-provider safety by requiring `Idempotency-Key` and enforcing
  uniqueness in Postgres.
- **Deterministic calculator over opaque plan generation.** BetterMe
  presents a generated personalised plan. Our result uses a simple,
  versioned, fixture-tested calculator so reviewers can audit every
  field.
- **Collapse subscription into session.** BetterMe needs real recurring
  subscription state. Our one-time mock payment only needs
  `entitlement_status` and `paid_at`; a separate subscription table
  would add billing semantics the MVP cannot exercise.
- **Conservative health-data scope.** BetterMe explicitly asks consent
  for health onboarding data. Our app does not transmit data to third
  parties; it still treats results as private API data with signed
  cookies and `Cache-Control: private, no-store`.

## 6. References

- BetterMe Pilates Quiz Funnel:
  https://betterme-pilates.com/first-page-brand-palette?flow=2117
- BetterMe footer docs observed in the flow:
  - https://betterme-pilates.com/privacy-policy?flow=2117
  - https://betterme-pilates.com/consumer-health-data-privacy-policy?flow=2117
  - https://betterme-pilates.com/subscription-policy?flow=2117
  - https://betterme-pilates.com/money-back-policy?flow=2117
- Challenge brief: `../test.md`
