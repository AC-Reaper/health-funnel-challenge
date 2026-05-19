import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { internalError } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getRequestId } from "@/lib/api/request-id";
import { checkSameOrigin } from "@/lib/api/same-origin";
import {
  COOKIE_NAME,
  buildSetCookieHeader,
  createSession,
  findAssessmentBySessionId,
  findSessionById,
  serializeSession,
  verifyCookie,
} from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Body is `{}` per docs/04-api-design.md §1. The schema is `strict` so any
 * unexpected field is rejected with 422 VALIDATION_ERROR rather than
 * silently ignored — keeps client/server contracts honest (ADR-005).
 */
const PostSessionsBody = z.object({}).strict();

export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const originCheck = checkSameOrigin(req, requestId);
  if (!originCheck.ok) return originCheck.res;

  try {
    const parsed = await parseJsonBody(req, PostSessionsBody, requestId);
    if (!parsed.ok) return parsed.res;

    const raw = (await cookies()).get(COOKIE_NAME)?.value;
    const existingSid = verifyCookie(raw);

    if (existingSid) {
      const session = await findSessionById(existingSid);
      if (session) {
        const assessment = await findAssessmentBySessionId(session.id);
        return NextResponse.json(serializeSession(session, assessment), {
          headers: {
            "x-request-id": requestId,
            "set-cookie": buildSetCookieHeader(session.id),
          },
        });
      }
    }

    const session = await createSession({
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    return NextResponse.json(serializeSession(session, null), {
      headers: {
        "x-request-id": requestId,
        "set-cookie": buildSetCookieHeader(session.id),
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "POST /api/v1/sessions failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}
