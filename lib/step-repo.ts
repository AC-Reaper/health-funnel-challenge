import "server-only";

import type { Assessment, Prisma, Session, StepKey } from "@prisma/client";

import { upsertAssessmentField } from "./assessment";
import { db } from "./db";
import { computeCurrentStep } from "./progress";
import type { StepBody } from "./validation/steps";

// ---------- Test seam (review-004-final N001) ----------

/**
 * Inputs to `createStepEvent`. Mirrors the columns we actually write so
 * the test fake can persist them without reaching into Prisma types.
 */
export interface CreateStepEventInput {
  sessionId: string;
  stepKey: StepKey;
  valueJson: unknown;
}

/**
 * Minimal structural interface over the Prisma transaction surface that
 * `runStepsTransaction` uses. Real implementation is built from a Prisma
 * `tx` (see `buildStepsOpsFromTx`); the test suite builds an in-memory
 * implementation backed by Maps so the per-step state machine —
 * assessment upsert + session current_step refresh + step_event audit
 * write — can be exercised without Supabase.
 */
export interface StepsTxOps {
  upsertAssessmentField<K extends StepKey>(
    sessionId: string,
    stepKey: K,
    patch: StepBody[K],
  ): Promise<Assessment>;
  updateSessionCurrentStep(
    sessionId: string,
    currentStep: StepKey,
  ): Promise<Session>;
  createStepEvent(input: CreateStepEventInput): Promise<void>;
}

export interface StepsOutcome {
  session: Session;
  assessment: Assessment;
}

// ---------- Pure orchestration ----------

/**
 * Pure PATCH orchestrator. Runs after every validation gate in the route
 * has passed (cookie, session state, isStepKey, Zod, first-incomplete,
 * coherence). Three writes in fixed order:
 *
 * 1. upsertAssessmentField — narrow per-step write to the assessment row.
 * 2. updateSessionCurrentStep — keeps `session.current_step` aligned with
 *    `computeCurrentStep(updatedAssessment)` and refreshes `updated_at`
 *    via Prisma `@updatedAt` (review-002 I006).
 * 3. createStepEvent — append-only audit row (ADR-009, T-502).
 *
 * In production all three execute inside the same `db.$transaction` so
 * a failure on any one rolls back the others — the audit cannot drift
 * from the assessment.
 */
export async function runStepsTransaction<K extends StepKey>(
  ops: StepsTxOps,
  sessionId: string,
  stepKey: K,
  patch: StepBody[K],
): Promise<StepsOutcome> {
  const updatedAssessment = await ops.upsertAssessmentField(
    sessionId,
    stepKey,
    patch,
  );
  const updatedSession = await ops.updateSessionCurrentStep(
    sessionId,
    computeCurrentStep(updatedAssessment),
  );
  await ops.createStepEvent({
    sessionId,
    stepKey,
    valueJson: patch,
  });
  return { session: updatedSession, assessment: updatedAssessment };
}

// ---------- Prisma adapter ----------

function buildStepsOpsFromTx(tx: Prisma.TransactionClient): StepsTxOps {
  return {
    upsertAssessmentField: (sessionId, stepKey, patch) =>
      upsertAssessmentField(sessionId, stepKey, patch, tx),
    updateSessionCurrentStep: (sessionId, currentStep) =>
      tx.session.update({
        where: { id: sessionId },
        data: { currentStep },
      }),
    createStepEvent: async (input) => {
      await tx.stepEvent.create({
        data: {
          sessionId: input.sessionId,
          stepKey: input.stepKey,
          valueJson: input.valueJson as Prisma.InputJsonValue,
        },
      });
    },
  };
}

/**
 * Production PATCH commit. Wraps the pure orchestrator in
 * `db.$transaction` so the three writes commit together.
 */
export async function persistStepPatch<K extends StepKey>(
  sessionId: string,
  stepKey: K,
  patch: StepBody[K],
): Promise<StepsOutcome> {
  return db.$transaction((tx) =>
    runStepsTransaction(buildStepsOpsFromTx(tx), sessionId, stepKey, patch),
  );
}
