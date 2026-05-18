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
import { processPayment, serializePayment } from "@/lib/payment";
import {
  COOKIE_NAME,
  findSessionById,
  verifyCookie,
} from "@/lib/session";

export const dynamic = "force-dynamic";

const PayBody = z.object({}).strict();
const IdempotencyKeySchema = z.string().min(1).max(128);

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  try {
    const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
    if (!sid) return noSession(requestId);

    const session = await findSessionById(sid);
    if (!session) return noSession(requestId);

    const rawKey = req.headers.get("idempotency-key");
    const keyParsed = IdempotencyKeySchema.safeParse(rawKey);
    if (!keyParsed.success) {
      return jsonError({
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message:
          "Idempotency-Key header is required and must be 1-128 characters.",
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
