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
import { findSessionById } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Demo / reviewer read by sessionId (ADR-018, brief §五-1c: "提供一个已支付
 * 的测试 sessionId，让我们能直接对比付费前后的差异化返回").
 *
 * The production read is the cookie-authenticated `GET /api/v1/results/me`.
 * This sibling lets a judge compare a paid vs free session by id WITHOUT a
 * cookie or any secret — exactly the pre/post-payment comparison the brief
 * asks for. It is safe to expose for the demo because:
 *   - it returns nothing `/results/me` doesn't (the SAME leak-tested
 *     `serializeTeaser` / `serializeFull`; teaser still cannot emit
 *     paid-only fields),
 *   - it is read-only (no grant, no write),
 *   - sessionIds are unguessable random UUIDs (`crypto.randomUUID()`),
 *     so this is not a meaningful enumeration surface for a $0 demo.
 * The cookie remains the real auth credential; this is a labelled demo aid.
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
    if (!session) {
      return withNoStore(
        jsonError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: "No session found for that id.",
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
