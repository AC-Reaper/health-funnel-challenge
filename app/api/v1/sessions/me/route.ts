import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { withNoStore } from "@/lib/api/cache-control";
import { internalError, noSession } from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/request-id";
import {
  COOKIE_NAME,
  findAssessmentBySessionId,
  findSessionById,
  serializeSession,
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

    const assessment = await findAssessmentBySessionId(sid);
    return withNoStore(
      NextResponse.json(serializeSession(session, assessment), {
        headers: { "x-request-id": requestId },
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "GET /api/v1/sessions/me failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}
