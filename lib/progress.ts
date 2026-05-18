import type { Assessment, StepKey } from "@prisma/client";

/**
 * Pure, server- and client-safe progress helpers.
 *
 * Lives separately from `lib/session.ts` (which is `server-only`) so a future
 * client component — funnel progress bar, paywall router — can import the
 * step order or `computeCurrentStep` without dragging Prisma, env, or
 * cookie-signing code into the client bundle.
 */

/** Order of the 6 funnel steps. ADR-008: first incomplete = current step. */
export const STEP_ORDER = [
  "gender",
  "main_goal",
  "age",
  "height",
  "weight",
  "activity",
] as const satisfies readonly StepKey[];

/**
 * Returns the first step whose corresponding `Assessment` column is null —
 * i.e. the first incomplete required step (ADR-008). If the assessment row
 * is null (no PATCH yet), returns "gender". If every required field is set,
 * returns the last step ("activity") — callers needing "submitted" semantics
 * should check `session.status` instead.
 */
export function computeCurrentStep(
  assessment: Assessment | null,
): StepKey {
  if (!assessment) return "gender";

  const filled: Record<(typeof STEP_ORDER)[number], boolean> = {
    gender: assessment.gender !== null,
    main_goal: assessment.mainGoal !== null,
    age: assessment.ageYears !== null,
    height: assessment.heightCm !== null,
    weight:
      assessment.weightKg !== null && assessment.targetWeightKg !== null,
    activity: assessment.activityLevel !== null,
  };

  for (const step of STEP_ORDER) {
    if (!filled[step]) return step;
  }
  return STEP_ORDER[STEP_ORDER.length - 1]!;
}
