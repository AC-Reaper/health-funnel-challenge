import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import { withNoStore } from "@/lib/api/cache-control";
import {
  ERROR_CODES,
  internalError,
  jsonError,
  noSession,
} from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/parse-body";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestId } from "@/lib/api/request-id";
import { checkSameOrigin } from "@/lib/api/same-origin";
import { AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/lib/payment";
import { COOKIE_NAME, findSessionById, verifyCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Body is `{}`. `.strict()` so a malformed body / wrong Content-Type /
 * unknown field is rejected up front (ADR-005 — Zod owns every boundary),
 * consistent with `POST /api/v1/sessions` and `/submit`.
 */
const CheckoutBody = z.object({}).strict();

/**
 * Create a (mock) checkout for the current session. Browser-facing:
 * cookie + same-origin + rate-limited. This endpoint **cannot** grant
 * entitlement — it only returns the order parameters. The grant happens
 * later, exclusively via the signature-verified
 * `/api/v1/payments/webhook` (ADR-017). No DB write.
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const originCheck = checkSameOrigin(req, requestId);
  if (!originCheck.ok) return originCheck.res;

  try {
    const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);

    const rl = await checkRateLimit(req, "checkout", requestId, sid);
    if (!rl.ok) return rl.res;

    const parsed = await parseJsonBody(req, CheckoutBody, requestId);
    if (!parsed.ok) return parsed.res;

    if (!sid) return noSession(requestId);

    const session = await findSessionById(sid);
    if (!session) return noSession(requestId);

    if (session.status !== "submitted") {
      return withNoStore(
        jsonError({
          status: 409,
          code: ERROR_CODES.NOT_SUBMITTED,
          message: "Submit the assessment before checkout.",
          requestId,
        }),
      );
    }

    // Already paid → nothing to check out. Idempotent, friendly UX.
    if (session.entitlementStatus === "paid") {
      return withNoStore(
        NextResponse.json(
          {
            sessionId: session.id,
            amountCents: AMOUNT_CENTS,
            currency: PAYMENT_CURRENCY,
            status: "completed" as const,
          },
          { headers: { "x-request-id": requestId } },
        ),
      );
    }

    // A real provider would persist an order; the mock keeps it
    // stateless and re-checks the canonical price in the webhook.
    return withNoStore(
      NextResponse.json(
        {
          checkoutId: randomUUID(),
          sessionId: session.id,
          amountCents: AMOUNT_CENTS,
          currency: PAYMENT_CURRENCY,
          status: "pending" as const,
        },
        { headers: { "x-request-id": requestId } },
      ),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "POST /api/v1/payments/checkout failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}
