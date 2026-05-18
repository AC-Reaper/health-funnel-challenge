import { z } from "zod";

import type { StepKey } from "@prisma/client";

/**
 * Per-step Zod schemas for `PATCH /api/v1/sessions/me/steps/:stepKey`.
 * Bounds mirror docs/04-api-design.md §3.
 *
 * Each schema validates only the fields that step owns. Cross-step
 * coherence (e.g. the weight × main_goal rule) is enforced in the
 * route handler because it needs to read the current assessment row.
 *
 * All schemas are `.strict()` so an unknown key fails validation
 * rather than being silently dropped, consistent with ADR-005 and
 * the POST /api/v1/sessions contract.
 */

const GenderSchema = z
  .object({
    gender: z.enum(["female", "male"]),
  })
  .strict();

const MainGoalSchema = z
  .object({
    mainGoal: z.enum(["lose_weight", "maintain", "gain_weight", "build_muscle"]),
  })
  .strict();

const AgeSchema = z
  .object({
    ageYears: z
      .number()
      .int("ageYears must be an integer")
      .min(13, "ageYears must be at least 13")
      .max(100, "ageYears must be at most 100"),
  })
  .strict();

const HeightSchema = z
  .object({
    heightCm: z
      .number()
      .int("heightCm must be an integer")
      .min(120, "heightCm must be at least 120")
      .max(230, "heightCm must be at most 230"),
  })
  .strict();

const WeightSchema = z
  .object({
    weightKg: z
      .number()
      .min(30, "weightKg must be at least 30")
      .max(250, "weightKg must be at most 250"),
    targetWeightKg: z
      .number()
      .min(30, "targetWeightKg must be at least 30")
      .max(250, "targetWeightKg must be at most 250"),
  })
  .strict();

const ActivitySchema = z
  .object({
    activityLevel: z.enum([
      "sedentary",
      "light",
      "moderate",
      "active",
      "very_active",
    ]),
  })
  .strict();

export const STEP_SCHEMAS = {
  gender: GenderSchema,
  main_goal: MainGoalSchema,
  age: AgeSchema,
  height: HeightSchema,
  weight: WeightSchema,
  activity: ActivitySchema,
} as const satisfies Record<StepKey, z.ZodTypeAny>;

export type StepBody = {
  gender: z.infer<typeof GenderSchema>;
  main_goal: z.infer<typeof MainGoalSchema>;
  age: z.infer<typeof AgeSchema>;
  height: z.infer<typeof HeightSchema>;
  weight: z.infer<typeof WeightSchema>;
  activity: z.infer<typeof ActivitySchema>;
};

export function isStepKey(value: string): value is StepKey {
  // `Object.hasOwn` (not the `in` operator) so inherited keys like
  // `toString`, `__proto__`, `constructor` are correctly rejected — they
  // would otherwise pass the guard and trigger a 500 inside the route
  // when STEP_SCHEMAS[key] turns out to be a function from Object.prototype.
  return Object.hasOwn(STEP_SCHEMAS, value);
}
