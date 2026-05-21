import { NextResponse } from "next/server";
import { z } from "zod";

import { withNoStore } from "@/lib/api/cache-control";
import {
  ERROR_CODES,
  internalError,
  jsonError,
} from "@/lib/api/errors";
import { getRequestId } from "@/lib/api/request-id";
import { findResultBySessionId } from "@/lib/result-repo";
import { serializeFull, serializeTeaser } from "@/lib/serializers/result";
import { findSessionById, isDemoSeedSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Demo / reviewer read by sessionId (ADR-018/019, brief §五-1c: "提供一个
 * 已支付的测试 sessionId，让我们能直接对比付费前后的差异化返回").
 *
 * The production read is the cookie-authenticated `GET /api/v1/results/me`.
 * This sibling lets a judge compare a paid vs free session by id WITHOUT a
 * cookie or any secret — exactly the pre/post-payment comparison the brief
 * asks for. It is scoped to **demo-seeded sessions only** (ADR-019): a
 * session is readable here iff its stored `user_agent` is the marker the
 * seed script sends (`isDemoSeedSession`). A real visitor's session — even
 * with a leaked or guessed UUID — returns 404, so this is not bearer
 * read-access to arbitrary health data; the signed cookie stays the real
 * credential for normal paths. It is also read-only and returns nothing
 * `/results/me` doesn't (the SAME leak-tested serializers).
 */
const Query = z.object({ sessionId: z.string().uuid() });

export async function GET(req: Request) {
  const requestId = getRequestId(req);

  try {
    const url = new URL(req.url);
    const parsed = Query.safeParse({ sessionId: url.searchParams.get("sessionId") });
    if (!parsed.success) {
      return withNoStore(
        jsonError({
          status: 400,
          code: ERROR_CODES.BAD_REQUEST,
          message: "Query param `sessionId` must be a valid UUID.",
          requestId,
        }),
      );
    }

    const sid = parsed.data.sessionId;
    const session = await findSessionById(sid);
    // Demo-scoped (ADR-019): only seeded demo sessions are readable by id.
    // Collapse "not found" and "not a demo session" into one 404 so this
    // endpoint never confirms the existence of a real visitor's session.
    if (!session || !isDemoSeedSession(session.userAgent)) {
      return withNoStore(
        jsonError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: "No demo session found for that id.",
          requestId,
        }),
      );
    }

    if (session.status !== "submitted") {
      return withNoStore(
        jsonError({
          status: 409,
          code: ERROR_CODES.NOT_SUBMITTED,
          message: "Session has not been submitted yet.",
          requestId,
        }),
      );
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
        msg: "GET /api/v1/results/by-session failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}
