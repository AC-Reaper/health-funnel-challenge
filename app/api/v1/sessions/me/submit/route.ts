import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  ERROR_CODES,
  internalError,
  jsonError,
  noSession,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getRequestId } from "@/lib/api/request-id";
import { checkSameOrigin } from "@/lib/api/same-origin";
import { stepIsFilled, type ProjectedAssessment } from "@/lib/assessment";
import { compute } from "@/lib/health/calculator";
import { STEP_ORDER } from "@/lib/progress";
import {
  assessmentToCalcInput,
  findResultBySessionId,
  submitAssessment,
} from "@/lib/result-repo";
import {
  COOKIE_NAME,
  findAssessmentBySessionId,
  findSessionById,
  verifyCookie,
} from "@/lib/session";
import { FULL_ASSESSMENT_SCHEMA } from "@/lib/validation/assessment";

import type { Assessment, StepKey } from "@prisma/client";

export const dynamic = "force-dynamic";

const SubmitBody = z.object({}).strict();

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const originCheck = checkSameOrigin(req, requestId);
  if (!originCheck.ok) return originCheck.res;

  try {
    const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
    if (!sid) return noSession(requestId);

    const session = await findSessionById(sid);
    if (!session) return noSession(requestId);

    const parsed = await parseJsonBody(req, SubmitBody, requestId);
    if (!parsed.ok) return parsed.res;

    // Idempotency: already submitted → return the canonical envelope
    // built from the existing result, no recompute.
    if (session.status === "submitted") {
      const existing = await findResultBySessionId(sid);
      if (!existing) {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "session is submitted but no result row exists",
            requestId,
            sessionId: sid,
          }),
        );
        return internalError(requestId);
      }
      return submitEnvelope(session.id, existing.id, session.submittedAt!, session.entitlementStatus, requestId);
    }

    const assessment = await findAssessmentBySessionId(sid);
    const missingSteps = listMissingSteps(assessment);
    if (missingSteps.length > 0 || !assessment) {
      return jsonError({
        status: 422,
        code: ERROR_CODES.INCOMPLETE_ASSESSMENT,
        message: "Assessment is missing required steps.",
        requestId,
        fields: { missingSteps },
      });
    }

    const calcInputResult = assessmentToCalcInput(assessment);
    if (!calcInputResult.ok) {
      // Defensive: stepIsFilled said complete, but the conversion sees a
      // null. Treat as INCOMPLETE; never reach the calculator with bad input.
      return jsonError({
        status: 422,
        code: ERROR_CODES.INCOMPLETE_ASSESSMENT,
        message: "Assessment is missing required steps.",
        requestId,
        fields: { missingSteps },
      });
    }

    const validated = FULL_ASSESSMENT_SCHEMA.safeParse(calcInputResult.input);
    if (!validated.success) {
      const fields: Record<string, string> = {};
      for (const issue of validated.error.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] = issue.message;
      }
      return jsonError({
        status: 422,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Stored assessment failed re-validation at /submit.",
        requestId,
        fields,
      });
    }

    const output = compute(validated.data);
    const { session: updatedSession, result } = await submitAssessment(sid, output);

    return submitEnvelope(
      updatedSession.id,
      result.id,
      updatedSession.submittedAt!,
      updatedSession.entitlementStatus,
      requestId,
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "POST /api/v1/sessions/me/submit failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}

function listMissingSteps(assessment: Assessment | null): StepKey[] {
  const projected = assessmentToProjected(assessment);
  return STEP_ORDER.filter((step) => !stepIsFilled(projected, step));
}

function assessmentToProjected(assessment: Assessment | null): ProjectedAssessment {
  return {
    gender: assessment?.gender ?? null,
    mainGoal: assessment?.mainGoal ?? null,
    ageYears: assessment?.ageYears ?? null,
    heightCm: assessment?.heightCm ?? null,
    weightKg: assessment?.weightKg != null ? Number(assessment.weightKg) : null,
    targetWeightKg:
      assessment?.targetWeightKg != null ? Number(assessment.targetWeightKg) : null,
    activityLevel: assessment?.activityLevel ?? null,
  };
}

function submitEnvelope(
  sessionId: string,
  resultId: string,
  submittedAt: Date,
  entitlementStatus: "free" | "paid",
  requestId: string,
): NextResponse {
  return NextResponse.json(
    {
      sessionId,
      submittedAt: submittedAt.toISOString(),
      resultId,
      entitlementStatus,
    },
    { headers: { "x-request-id": requestId } },
  );
}
