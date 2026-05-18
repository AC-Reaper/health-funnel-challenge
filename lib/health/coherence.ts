import type { MainGoal } from "@prisma/client";

/**
 * Pure cross-field coherence between weight pair and main_goal.
 *
 * Lives under lib/health/ alongside the calculator (no server-only),
 * so both the per-step PATCH (lib/assessment.ts), the /submit Zod
 * superRefine (lib/validation/assessment.ts), and any future client
 * component can share the same rule.
 *
 * Returns null on success or a structured field-message map on violation.
 * `build_muscle` accepts any target direction (review-002 N004).
 */
export interface WeightCoherenceError {
  ok: false;
  fields: Record<"weightKg" | "targetWeightKg", string>;
}

export function checkWeightCoherence(
  mainGoal: MainGoal,
  weightKg: number,
  targetWeightKg: number,
): WeightCoherenceError | null {
  const diff = targetWeightKg - weightKg;

  if (mainGoal === "lose_weight" && diff >= 0) {
    return weightCoherenceError(
      "targetWeightKg must be less than weightKg for goal 'lose_weight'",
      weightKg,
      targetWeightKg,
    );
  }
  if (mainGoal === "gain_weight" && diff <= 0) {
    return weightCoherenceError(
      "targetWeightKg must be greater than weightKg for goal 'gain_weight'",
      weightKg,
      targetWeightKg,
    );
  }
  if (mainGoal === "maintain" && Math.abs(diff) > 2) {
    return weightCoherenceError(
      "targetWeightKg must be within 2kg of weightKg for goal 'maintain'",
      weightKg,
      targetWeightKg,
    );
  }
  return null;
}

function weightCoherenceError(
  message: string,
  weightKg: number,
  targetWeightKg: number,
): WeightCoherenceError {
  return {
    ok: false,
    fields: {
      weightKg: `${message} (weightKg=${weightKg}, targetWeightKg=${targetWeightKg})`,
      targetWeightKg: message,
    },
  };
}
