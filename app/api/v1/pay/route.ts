import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  ERROR_CODES,
  internalError,
  jsonError,
  noSession,
} from "@/lib/api/errors";
import { IDEMPOTENCY_KEY_SCHEMA } from "@/lib/api/idempotency-key";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getRequestId } from "@/lib/api/request-id";
import { checkSameOrigin } from "@/lib/api/same-origin";
import { processPayment, serializePayment } from "@/lib/payment";
import {
  COOKIE_NAME,
  findSessionById,
  verifyCookie,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const PayBody = z.object({}).strict();

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const originCheck = checkSameOrigin(req, requestId);
  if (!originCheck.ok) return originCheck.res;

  try {
    const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
    if (!sid) return noSession(requestId);

    const session = await findSessionById(sid);
    if (!session) return noSession(requestId);

    // Pay must come after submit (review-010 P1). The pure
    // `decidePaymentAction` mirrors this gate for the state machine;
    // the route holds the canonical API contract.
    if (session.status !== "submitted") {
      return jsonError({
        status: 409,
        code: ERROR_CODES.NOT_SUBMITTED,
        message: "Submit the assessment before payment.",
        requestId,
      });
    }

    const rawKey = req.headers.get("idempotency-key");
    const keyParsed = IDEMPOTENCY_KEY_SCHEMA.safeParse(rawKey);
    if (!keyParsed.success) {
      return jsonError({
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message:
          keyParsed.error.issues[0]?.message ??
          "Idempotency-Key header is required.",
        requestId,
      });
    }

    const body = await parseJsonBody(req, PayBody, requestId);
    if (!body.ok) return body.res;

    const outcome = await processPayment(sid, keyParsed.data);

    return NextResponse.json(serializePayment(outcome), {
      headers: { "x-request-id": requestId },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "POST /api/v1/pay failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}
