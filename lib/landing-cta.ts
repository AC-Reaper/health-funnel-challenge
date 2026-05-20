/**
 * Pure decision for the landing-page CTA, so the page server component
 * stays a thin I/O shell and the branch logic gets a unit test (same
 * pattern as `lib/payment.ts:decidePaymentAction`). Client-safe — no
 * `server-only` import — so it can be reused anywhere.
 *
 * The label must match what actually happens when clicked:
 *   - no session            → "Start the quiz"   → create + /funnel
 *   - draft, no answers yet  → "Start the quiz"   → /funnel (reuses draft)
 *   - draft, has answers     → "Continue the quiz" → /funnel (resumes)
 *   - submitted (free/paid)  → "View your results" → /results
 *
 * The submitted → results case is the bug fix: previously the label
 * said "Start the quiz" but a submitted session is redirected straight
 * to /results, so the button promised a fresh quiz it never delivered.
 */
export type LandingCta = "start" | "continue" | "results";

export function resolveLandingCta(
  session: { status: "draft" | "submitted" } | null,
  hasAnswers: boolean,
): LandingCta {
  if (!session) return "start";
  if (session.status === "submitted") return "results";
  return hasAnswers ? "continue" : "start";
}
