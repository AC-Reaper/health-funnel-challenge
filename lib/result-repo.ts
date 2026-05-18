import "server-only";

import type { Assessment, Result, Session, Prisma } from "@prisma/client";

import { db } from "./db";
import type { CalculatorOutput } from "./health/calculator";

// ---------- Test seam (review-006 B001) ----------

/**
 * Inputs to `createResult`. Mirrors the columns we actually write so a
 * test fake can persist them without reaching into Prisma types.
 */
export interface CreateResultInput {
  sessionId: string;
  bmi: number;
  bmiCategory: Result["bmiCategory"];
  dailyCaloriesKcal: number;
  predictedTargetDate: Date | null;
  curvePointsJson: unknown;
  planJson: unknown;
  algorithmVersion: string;
}

/**
 * Minimal structural interface over the Prisma transaction surface that
 * `runSubmitTransaction` uses. Real implementation built from a Prisma
 * `tx` (see `buildSubmitOpsFromTx`); the test suite builds an in-memory
 * implementation backed by Maps so /submit idempotency can be exercised
 * without Supabase (review-006 B001).
 */
export interface SubmitTxOps {
  findResult(sessionId: string): Promise<Result | null>;
  /** Throws `{ code: "P2002" }` if `sessionId` already has a result row. */
  createResult(input: CreateResultInput): Promise<Result>;
  updateSessionToSubmitted(sessionId: string, submittedAt: Date): Promise<Session>;
}

export interface SubmitOutcome {
  session: Session;
  result: Result;
}

// ---------- Top-level read used outside the transaction ----------

export async function findResultBySessionId(
  sessionId: string,
): Promise<Result | null> {
  return db.result.findUnique({ where: { sessionId } });
}

// ---------- Pure orchestration ----------

/**
 * Pure submit orchestrator. Idempotent by construction: the UNIQUE
 * constraint on `result.session_id` catches a concurrent submit; we
 * recover by reading the existing row instead of re-running the
 * calculator. Re-submits with a different assessment do not recompute
 * — see docs/04 §4 "the assessment fields used to compute it are never
 * recomputed even if the user later edits a step".
 */
export async function runSubmitTransaction(
  ops: SubmitTxOps,
  sessionId: string,
  output: CalculatorOutput,
  now: Date = new Date(),
): Promise<SubmitOutcome> {
  let result: Result;
  try {
    result = await ops.createResult({
      sessionId,
      bmi: output.bmi,
      bmiCategory: output.bmiCategory,
      dailyCaloriesKcal: output.dailyCaloriesKcal,
      predictedTargetDate: output.predictedTargetDate,
      curvePointsJson: output.curvePoints,
      planJson: output.plan,
      algorithmVersion: output.algorithmVersion,
    });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      const existing = await ops.findResult(sessionId);
      if (!existing) throw err;
      result = existing;
    } else {
      throw err;
    }
  }

  const session = await ops.updateSessionToSubmitted(sessionId, now);
  return { session, result };
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

// ---------- Prisma adapter ----------

function buildSubmitOpsFromTx(tx: Prisma.TransactionClient): SubmitTxOps {
  return {
    findResult: (sessionId) =>
      tx.result.findUnique({ where: { sessionId } }),
    createResult: (input) =>
      tx.result.create({
        data: {
          sessionId: input.sessionId,
          bmi: input.bmi,
          bmiCategory: input.bmiCategory,
          dailyCaloriesKcal: input.dailyCaloriesKcal,
          predictedTargetDate: input.predictedTargetDate,
          curvePointsJson: input.curvePointsJson as Prisma.InputJsonValue,
          planJson: input.planJson as Prisma.InputJsonValue,
          algorithmVersion: input.algorithmVersion,
        },
      }),
    updateSessionToSubmitted: (sessionId, submittedAt) =>
      tx.session.update({
        where: { id: sessionId },
        data: { status: "submitted", submittedAt },
      }),
  };
}

/**
 * Production submit. Wraps the pure orchestrator in `db.$transaction` so
 * the result insert and the session-status update commit together.
 */
export async function submitAssessment(
  sessionId: string,
  output: CalculatorOutput,
): Promise<SubmitOutcome> {
  return db.$transaction((tx) =>
    runSubmitTransaction(buildSubmitOpsFromTx(tx), sessionId, output),
  );
}

// ---------- Calculator-input adapter ----------

/** Builds the calculator input from a fully-populated assessment row. */
export function assessmentToCalcInput(
  assessment: Assessment,
):
  | {
      ok: true;
      input: {
        gender: NonNullable<Assessment["gender"]>;
        mainGoal: NonNullable<Assessment["mainGoal"]>;
        ageYears: number;
        heightCm: number;
        weightKg: number;
        targetWeightKg: number;
        activityLevel: NonNullable<Assessment["activityLevel"]>;
      };
    }
  | { ok: false } {
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
