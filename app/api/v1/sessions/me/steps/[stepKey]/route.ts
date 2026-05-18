import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  ERROR_CODES,
  internalError,
  jsonError,
  noSession,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getRequestId } from "@/lib/api/request-id";
import {
  checkWeightCoherence,
  upsertAssessmentField,
} from "@/lib/assessment";
import { STEP_ORDER } from "@/lib/progress";
import {
  COOKIE_NAME,
  findAssessmentBySessionId,
  findSessionById,
  serializeSession,
  verifyCookie,
} from "@/lib/session";
import { STEP_SCHEMAS, isStepKey } from "@/lib/validation/steps";

import type { Assessment, StepKey } from "@prisma/client";
import type { z } from "zod";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { stepKey: string } },
) {
  const requestId = getRequestId(req);

  try {
    const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
    if (!sid) return noSession(requestId);

    const session = await findSessionById(sid);
    if (!session) return noSession(requestId);

    if (session.status === "submitted") {
      return jsonError({
        status: 409,
        code: ERROR_CODES.ALREADY_SUBMITTED,
        message: "Session has already been submitted; answers are immutable.",
        requestId,
      });
    }

    const { stepKey } = params;
    if (!isStepKey(stepKey)) {
      return jsonError({
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: `Unknown step key: ${stepKey}.`,
        requestId,
      });
    }

    // STEP_SCHEMAS[stepKey] is a discriminated union over StepKey; the
    // narrowing in `projectAssessment` re-validates per-step.
    const schema = STEP_SCHEMAS[stepKey] as z.ZodType<unknown>;
    const parsed = await parseJsonBody(req, schema, requestId);
    if (!parsed.ok) return parsed.res;

    const current = await findAssessmentBySessionId(sid);

    const projected = projectAssessment(current, stepKey, parsed.data);

    const missing = firstMissingPrereq(stepKey, projected);
    if (missing) {
      return jsonError({
        status: 409,
        code: ERROR_CODES.STEP_OUT_OF_ORDER,
        message: `Cannot save '${stepKey}' before '${missing}'.`,
        requestId,
        fields: { firstMissingStep: missing },
      });
    }

    if (stepKey === "weight") {
      const mainGoal = projected.mainGoal;
      const w = projected.weightKg;
      const t = projected.targetWeightKg;
      if (mainGoal && w !== null && t !== null) {
        const violation = checkWeightCoherence(mainGoal, Number(w), Number(t));
        if (violation) {
          return jsonError({
            status: 422,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: "weightKg and targetWeightKg are inconsistent with mainGoal.",
            requestId,
            fields: violation.fields,
          });
        }
      }
    }

    // Safe cast: STEP_SCHEMAS[stepKey] just produced this exact body shape.
    await upsertAssessmentField(
      sid,
      stepKey,
      parsed.data as Parameters<typeof upsertAssessmentField>[2],
    );

    const [freshSession, freshAssessment] = await Promise.all([
      findSessionById(sid),
      findAssessmentBySessionId(sid),
    ]);
    if (!freshSession) return noSession(requestId);

    return NextResponse.json(
      serializeSession(freshSession, freshAssessment),
      { headers: { "x-request-id": requestId } },
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: `PATCH /api/v1/sessions/me/steps/${params.stepKey} failed`,
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}

/**
 * Builds the assessment state as it would look after the patch is
 * applied. Used by the first-incomplete-step rule and by the weight
 * coherence check, so we don't UPSERT first and roll back on
 * validation failure.
 */
type ProjectedAssessment = {
  gender: Assessment["gender"] | null;
  mainGoal: Assessment["mainGoal"] | null;
  ageYears: Assessment["ageYears"] | null;
  heightCm: Assessment["heightCm"] | null;
  weightKg: Assessment["weightKg"] | null;
  targetWeightKg: Assessment["targetWeightKg"] | null;
  activityLevel: Assessment["activityLevel"] | null;
};

function projectAssessment(
  current: Assessment | null,
  stepKey: StepKey,
  patch: unknown,
): ProjectedAssessment {
  const next: ProjectedAssessment = {
    gender: current?.gender ?? null,
    mainGoal: current?.mainGoal ?? null,
    ageYears: current?.ageYears ?? null,
    heightCm: current?.heightCm ?? null,
    weightKg: current?.weightKg ?? null,
    targetWeightKg: current?.targetWeightKg ?? null,
    activityLevel: current?.activityLevel ?? null,
  };

  const p = patch as Record<string, unknown>;
  switch (stepKey) {
    case "gender":
      next.gender = p.gender as ProjectedAssessment["gender"];
      break;
    case "main_goal":
      next.mainGoal = p.mainGoal as ProjectedAssessment["mainGoal"];
      break;
    case "age":
      next.ageYears = p.ageYears as number;
      break;
    case "height":
      next.heightCm = p.heightCm as number;
      break;
    case "weight":
      next.weightKg = p.weightKg as ProjectedAssessment["weightKg"];
      next.targetWeightKg = p.targetWeightKg as ProjectedAssessment["targetWeightKg"];
      break;
    case "activity":
      next.activityLevel = p.activityLevel as ProjectedAssessment["activityLevel"];
      break;
  }
  return next;
}

/**
 * First-incomplete-step rule (ADR-008). Walks STEP_ORDER up to (but
 * not including) the step being saved; if any earlier required step
 * is still unfilled in the projected state, returns that step name.
 * Editing an already-saved step is always allowed because its own
 * column would already be non-null in `current`.
 */
function firstMissingPrereq(
  stepKey: StepKey,
  projected: ProjectedAssessment,
): StepKey | null {
  for (const step of STEP_ORDER) {
    if (step === stepKey) return null;
    if (!stepIsFilled(projected, step)) return step;
  }
  return null;
}

function stepIsFilled(p: ProjectedAssessment, step: StepKey): boolean {
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
