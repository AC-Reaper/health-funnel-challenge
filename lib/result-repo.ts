import "server-only";

import type { Assessment, Result, Session, Prisma } from "@prisma/client";

import { db } from "./db";
import type { CalculatorOutput } from "./health/calculator";

export async function findResultBySessionId(
  sessionId: string,
): Promise<Result | null> {
  return db.result.findUnique({ where: { sessionId } });
}

export interface SubmitOutcome {
  session: Session;
  result: Result;
}

/**
 * Idempotent submit. Runs one transaction:
 *   - INSERT the result snapshot (UNIQUE session_id makes the insert
 *     fail-fast on a concurrent racer; we catch P2002 and return the
 *     row that won the race).
 *   - UPDATE session.status='submitted', submitted_at=now()
 *     (idempotent if already submitted; conditional WHERE).
 *
 * Re-submits with a different assessment do not recompute — see
 * docs/04 §4 "the assessment fields used to compute it are never
 * recomputed even if the user later edits a step".
 */
export async function submitAssessment(
  sessionId: string,
  output: CalculatorOutput,
): Promise<SubmitOutcome> {
  return db.$transaction(async (tx) => {
    let result: Result;
    try {
      result = await tx.result.create({
        data: {
          sessionId,
          bmi: output.bmi,
          bmiCategory: output.bmiCategory,
          dailyCaloriesKcal: output.dailyCaloriesKcal,
          predictedTargetDate: output.predictedTargetDate,
          curvePointsJson: output.curvePoints as unknown as Prisma.InputJsonValue,
          planJson: output.plan as unknown as Prisma.InputJsonValue,
          algorithmVersion: output.algorithmVersion,
        },
      });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        // Concurrent /submit racer beat us — read the existing row.
        const existing = await tx.result.findUnique({ where: { sessionId } });
        if (!existing) throw err;
        result = existing;
      } else {
        throw err;
      }
    }

    const session = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: "submitted",
        submittedAt: new Date(),
      },
    });

    return { session, result };
  });
}

/** Builds the calculator input from a fully-populated assessment row. */
export function assessmentToCalcInput(
  assessment: Assessment,
): {
  ok: true;
  input: NonNullable<{
    gender: NonNullable<Assessment["gender"]>;
    mainGoal: NonNullable<Assessment["mainGoal"]>;
    ageYears: number;
    heightCm: number;
    weightKg: number;
    targetWeightKg: number;
    activityLevel: NonNullable<Assessment["activityLevel"]>;
  }>;
} | { ok: false } {
  if (
    assessment.gender === null ||
    assessment.mainGoal === null ||
    assessment.ageYears === null ||
    assessment.heightCm === null ||
    assessment.weightKg === null ||
    assessment.targetWeightKg === null ||
    assessment.activityLevel === null
  ) {
    return { ok: false };
  }
  return {
    ok: true,
    input: {
      gender: assessment.gender,
      mainGoal: assessment.mainGoal,
      ageYears: assessment.ageYears,
      heightCm: assessment.heightCm,
      weightKg: Number(assessment.weightKg),
      targetWeightKg: Number(assessment.targetWeightKg),
      activityLevel: assessment.activityLevel,
    },
  };
}
