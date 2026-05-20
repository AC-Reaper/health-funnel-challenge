import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { withNoStore } from "@/lib/api/cache-control";
import {
  ERROR_CODES,
  internalError,
  jsonError,
  noSession,
} from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/request-id";
import { findResultBySessionId } from "@/lib/result-repo";
import { serializeFull, serializeTeaser } from "@/lib/serializers/result";
import {
  COOKIE_NAME,
  findSessionById,
  verifyCookie,
} from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);
    if (!sid) return noSession(requestId);

    const session = await findSessionById(sid);
    if (!session) return noSession(requestId);

    if (session.status !== "submitted") {
      return jsonError({
        status: 409,
        code: ERROR_CODES.NOT_SUBMITTED,
        message: "Submit the assessment before requesting results.",
        requestId,
      });
    }

    const result = await findResultBySessionId(sid);
    if (!result) {
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

    const body =
      session.entitlementStatus === "paid"
        ? serializeFull(result)
        : serializeTeaser(result);

    return withNoStore(
      NextResponse.json(body, {
        headers: { "x-request-id": requestId },
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "GET /api/v1/results/me failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}
