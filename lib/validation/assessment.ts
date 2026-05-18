import { z } from "zod";

import type { CalculatorInput } from "../health/calculator";
import { checkWeightCoherence } from "../health/coherence";

/**
 * Full assessment schema composed from the per-step schemas in
 * lib/validation/steps.ts. Used by POST /api/v1/sessions/me/submit
 * to re-validate the entire stored assessment after reading non-null
 * fields from the DB (belt-and-suspenders on top of the per-step
 * guards).
 *
 * Each field carries the same bounds the step schema enforces — if a
 * future change widens a step schema without updating this composite,
 * the test suite catches it.
 *
 * `.superRefine()` runs the same weight × main_goal coherence rule the
 * step API enforces (review-006 I001). This is the final server-trusted
 * guard before the calculator: a row inserted via any non-step path
 * (manual DB edit, future regression) still cannot reach `compute()`
 * with an incoherent weight pair.
 */
export const FULL_ASSESSMENT_SCHEMA = z
  .object({
    gender: z.enum(["female", "male"]),
    mainGoal: z.enum(["lose_weight", "maintain", "gain_weight", "build_muscle"]),
    ageYears: z.number().int().min(13).max(100),
    heightCm: z.number().int().min(120).max(230),
    weightKg: z.number().min(30).max(250),
    targetWeightKg: z.number().min(30).max(250),
    activityLevel: z.enum([
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ]),
  })
  .superRefine((value, ctx) => {
    const violation = checkWeightCoherence(
      value.mainGoal,
      value.weightKg,
      value.targetWeightKg,
    );
    if (!violation) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mainGoal"],
      message: `mainGoal '${value.mainGoal}' is incoherent with the saved weight pair (weightKg=${value.weightKg}, targetWeightKg=${value.targetWeightKg})`,
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["weightKg"],
      message: violation.fields.weightKg,
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetWeightKg"],
      message: violation.fields.targetWeightKg,
    });
  }) satisfies z.ZodType<Omit<CalculatorInput, "now">>;

export type FullAssessment = z.infer<typeof FULL_ASSESSMENT_SCHEMA>;
