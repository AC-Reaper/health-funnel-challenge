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
  checkMainGoalChange,
  checkWeightCoherence,
  firstMissingPrereq,
  projectAssessment,
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

    // Safe cast: STEP_SCHEMAS[stepKey] just produced this exact body
    // shape; projectAssessment narrows via the stepKey discriminator.
    const patch = parsed.data as Parameters<typeof projectAssessment>[2];
    const projected = projectAssessment(current, stepKey, patch);

    const missing = firstMissingPrereq(stepKey, projected, STEP_ORDER);
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
      const { mainGoal, weightKg, targetWeightKg } = projected;
      if (mainGoal && weightKg !== null && targetWeightKg !== null) {
        const violation = checkWeightCoherence(mainGoal, weightKg, targetWeightKg);
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

    // review-002 I005: PATCH main_goal against a saved weight pair must
    // not leave the assessment incoherent. The check runs against the
    // currently-stored pair (Decimal -> number via projected) and the
    // newly-requested mainGoal.
    if (stepKey === "main_goal") {
      const newMainGoal = projected.mainGoal;
      const violation =
        newMainGoal &&
        checkMainGoalChange(
          projected.weightKg,
          projected.targetWeightKg,
          newMainGoal,
        );
      if (violation) {
        return jsonError({
          status: 422,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "mainGoal is inconsistent with the saved weightKg / targetWeightKg pair.",
          requestId,
          fields: violation.fields,
        });
      }
    }

    await upsertAssessmentField(
      sid,
      stepKey,
      patch as Parameters<typeof upsertAssessmentField>[2],
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
