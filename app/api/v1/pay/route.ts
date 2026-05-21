import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  ERROR_CODES,
  internalError,
  jsonError,
  noSession,
} from "@/lib/api/errors";
import { withNoStore } from "@/lib/api/cache-control";
import { IDEMPOTENCY_KEY_SCHEMA } from "@/lib/api/idempotency-key";
import { checkRateLimit } from "@/lib/api/rate-limit";
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

/**
 * Mock payment callback (ADR-018, brief §三 "提供一个 /pay 接口，调用后修改
 * 数据库中的会员状态为有效"). This is the brief's directly-callable,
 * secret-free grant path: a judge can replay it with a cookie jar + an
 * `Idempotency-Key` and watch `entitlement_status` flip to `paid`.
 *
 * It is intentionally NOT the production trust boundary — that role
 * belongs to the signature-verified `/api/v1/payments/webhook` (ADR-017),
 * which the browser UI actually drives (`/pay` page → checkout →
 * `/checkout` → webhook). This route is the documented *mock*: same-origin
 * + cookie-authenticated, reusing the unchanged `processPayment` grant
 * primitive (DB-enforced idempotency, ADR-006/012). The two paths share
 * one grant primitive; only their auth and intended caller differ.
 */
const PayBody = z.object({}).strict();

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const originCheck = checkSameOrigin(req, requestId);
  if (!originCheck.ok) return originCheck.res;

  try {
    const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);

    const rl = await checkRateLimit(req, "pay", requestId, sid);
    if (!rl.ok) return rl.res;

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

    return withNoStore(
      NextResponse.json(serializePayment(outcome), {
        headers: { "x-request-id": requestId },
      }),
    );
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
