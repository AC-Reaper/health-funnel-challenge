import "server-only";

import type { Assessment, MainGoal, StepKey } from "@prisma/client";

import { db } from "./db";
import type { StepBody } from "./validation/steps";

type AssessmentFieldPatch = {
  gender?: StepBody["gender"]["gender"];
  mainGoal?: StepBody["main_goal"]["mainGoal"];
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activityLevel?: StepBody["activity"]["activityLevel"];
};

/**
 * Per-step Prisma upsert. Creates the assessment row on first PATCH
 * (writes only the step's columns + sessionId), and updates only the
 * step's columns on subsequent calls. Other columns stay null until
 * their step is saved. `Assessment.updatedAt` refreshes via @updatedAt
 * on every write.
 */
export async function upsertAssessmentField<K extends StepKey>(
  sessionId: string,
  stepKey: K,
  patch: StepBody[K],
): Promise<Assessment> {
  const data = stepPatchToColumns(stepKey, patch);
  return db.assessment.upsert({
    where: { sessionId },
    create: { sessionId, ...data },
    update: data,
  });
}

function stepPatchToColumns<K extends StepKey>(
  stepKey: K,
  patch: StepBody[K],
): AssessmentFieldPatch {
  switch (stepKey) {
    case "gender":
      return { gender: (patch as StepBody["gender"]).gender };
    case "main_goal":
      return { mainGoal: (patch as StepBody["main_goal"]).mainGoal };
    case "age":
      return { ageYears: (patch as StepBody["age"]).ageYears };
    case "height":
      return { heightCm: (patch as StepBody["height"]).heightCm };
    case "weight": {
      const w = patch as StepBody["weight"];
      return { weightKg: w.weightKg, targetWeightKg: w.targetWeightKg };
    }
    case "activity":
      return {
        activityLevel: (patch as StepBody["activity"]).activityLevel,
      };
    default: {
      const _exhaustive: never = stepKey;
      throw new Error(`Unhandled stepKey: ${String(_exhaustive)}`);
    }
  }
}

export interface WeightCoherenceError {
  ok: false;
  fields: Record<"weightKg" | "targetWeightKg", string>;
}

/**
 * Pure helper: enforces the weight × main_goal rule from docs/04 §3.
 * Returns null on success, a structured error map on violation.
 * `build_muscle` accepts any direction (spec is silent on it).
 */
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
