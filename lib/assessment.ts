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

export interface MainGoalChangeError {
  ok: false;
  fields: Record<"mainGoal" | "targetWeightKg", string>;
}

/**
 * Pure helper: enforces the weight × main_goal rule when the user changes
 * `main_goal` and a `weight` pair is already stored (review-002 I005).
 * Returns null if either weight field is unset (no possible conflict) or
 * if the new goal is coherent with the stored pair; otherwise returns a
 * field-message map suitable for a `422 VALIDATION_ERROR` envelope.
 */
export function checkMainGoalChange(
  currentWeightKg: number | null,
  currentTargetWeightKg: number | null,
  newMainGoal: MainGoal,
): MainGoalChangeError | null {
  if (currentWeightKg === null || currentTargetWeightKg === null) return null;

  const violation = checkWeightCoherence(
    newMainGoal,
    currentWeightKg,
    currentTargetWeightKg,
  );
  if (!violation) return null;

  return {
    ok: false,
    fields: {
      mainGoal: `saved weight pair (weightKg=${currentWeightKg}, targetWeightKg=${currentTargetWeightKg}) is incompatible with mainGoal='${newMainGoal}'`,
      targetWeightKg:
        "incompatible with new mainGoal; PATCH /api/v1/sessions/me/steps/weight first",
    },
  };
}

// ---------- Pure step-projection helpers (no I/O) ----------
//
// Extracted from the PATCH route so they can be unit-tested without a
// Prisma client. Used by both the first-incomplete-step rule (ADR-008)
// and the future `/submit` validator (T-302).

/**
 * The shape the assessment row would have if the patch were applied.
 * `weightKg` / `targetWeightKg` are stored as Decimal in Postgres; the
 * projection coerces them to `number` because the validation logic only
 * does comparisons (gt/lt/abs), not Decimal-precise arithmetic.
 */
export type ProjectedAssessment = {
  gender: Assessment["gender"] | null;
  mainGoal: Assessment["mainGoal"] | null;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  activityLevel: Assessment["activityLevel"] | null;
};

/**
 * Builds the assessment state as it WOULD look after the patch is applied,
 * without writing anything to the database. Used by the first-incomplete-
 * step check and the main_goal-coherence check, so we don't UPSERT first
 * and roll back on validation failure.
 */
export function projectAssessment<K extends StepKey>(
  current: Assessment | null,
  stepKey: K,
  patch: StepBody[K],
): ProjectedAssessment {
  const next: ProjectedAssessment = {
    gender: current?.gender ?? null,
    mainGoal: current?.mainGoal ?? null,
    ageYears: current?.ageYears ?? null,
    heightCm: current?.heightCm ?? null,
    weightKg: current?.weightKg != null ? Number(current.weightKg) : null,
    targetWeightKg:
      current?.targetWeightKg != null ? Number(current.targetWeightKg) : null,
    activityLevel: current?.activityLevel ?? null,
  };

  switch (stepKey) {
    case "gender":
      next.gender = (patch as StepBody["gender"]).gender;
      break;
    case "main_goal":
      next.mainGoal = (patch as StepBody["main_goal"]).mainGoal;
      break;
    case "age":
      next.ageYears = (patch as StepBody["age"]).ageYears;
      break;
    case "height":
      next.heightCm = (patch as StepBody["height"]).heightCm;
      break;
    case "weight": {
      const w = patch as StepBody["weight"];
      next.weightKg = w.weightKg;
      next.targetWeightKg = w.targetWeightKg;
      break;
    }
    case "activity":
      next.activityLevel = (patch as StepBody["activity"]).activityLevel;
      break;
  }
  return next;
}

/** Is the specified step considered "filled" in the projected state? */
export function stepIsFilled(p: ProjectedAssessment, step: StepKey): boolean {
  switch (step) {
    case "gender":
      return p.gender !== null;
    case "main_goal":
      return p.mainGoal !== null;
    case "age":
      return p.ageYears !== null;
    case "height":
      return p.heightCm !== null;
    case "weight":
      return p.weightKg !== null && p.targetWeightKg !== null;
    case "activity":
      return p.activityLevel !== null;
  }
}

/**
 * First-incomplete-step rule (ADR-008). Walks STEP_ORDER up to (but not
 * including) the step being saved; if any earlier required step is still
 * unfilled in the projected state, returns that step's name. Editing an
 * already-saved step is always allowed because its own column is already
 * non-null in `current`.
 */
export function firstMissingPrereq(
  stepKey: StepKey,
  projected: ProjectedAssessment,
  stepOrder: readonly StepKey[],
): StepKey | null {
  for (const step of stepOrder) {
    if (step === stepKey) return null;
    if (!stepIsFilled(projected, step)) return step;
  }
  return null;
}
