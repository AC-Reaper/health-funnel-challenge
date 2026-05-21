import { NextResponse } from "next/server";

import { withNoStore } from "@/lib/api/cache-control";
import { ERROR_CODES, internalError, jsonError } from "@/lib/api/errors";
import { MAX_BODY_BYTES } from "@/lib/api/parse-body";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestId } from "@/lib/api/request-id";
import { env } from "@/lib/env";
import { processPayment, serializePayment } from "@/lib/payment";
import {
  WEBHOOK_PAYLOAD_SCHEMA,
  validateWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/payment-webhook";
import { findSessionById } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Simulated payment-provider webhook (ADR-017). This is the ONLY path
 * that grants entitlement. There is no cookie and no same-origin check —
 * a real provider calls cross-origin — so the auth is the HMAC
 * signature over the raw body (`X-Payment-Signature`). After the
 * signature and the amount/currency/status checks pass, it delegates to
 * the unchanged `processPayment` (DB-enforced idempotency, ADR-006/012).
 */
export async function POST(req: Request) {
  const requestId = getRequestId(req);

  const rl = await checkRateLimit(req, "webhook", requestId, null);
  if (!rl.ok) return rl.res;

  try {
    // Read the raw body first — the signature commits to these exact
    // bytes, so we must verify before JSON.parse.
    const declared = req.headers.get("content-length");
    if (declared !== null) {
      const n = Number(declared);
      if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
        return tooLarge(requestId);
      }
    }
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return tooLarge(requestId);
    }

    const signature = req.headers.get("x-payment-signature");
    if (!verifyWebhookSignature(raw, signature, env.PAYMENT_WEBHOOK_SECRET)) {
      return withNoStore(
        jsonError({
          status: 401,
          code: ERROR_CODES.INVALID_SIGNATURE,
          message: "Missing or invalid webhook signature.",
          requestId,
        }),
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return withNoStore(
        jsonError({
          status: 400,
          code: ERROR_CODES.BAD_REQUEST,
          message: "Webhook body is not valid JSON.",
          requestId,
        }),
      );
    }

    const parsed = WEBHOOK_PAYLOAD_SCHEMA.safeParse(parsedJson);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fields[issue.path.join(".") || "_"] = issue.message;
      }
      return withNoStore(
        jsonError({
          status: 422,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "Webhook payload failed validation.",
          requestId,
          fields,
        }),
      );
    }

    const check = validateWebhookPayload(parsed.data);
    if (!check.ok) {
      return withNoStore(
        jsonError({
          status: 422,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Webhook payload rejected: ${check.reason}.`,
          requestId,
        }),
      );
    }

    // Provider-facing contract: a signature-valid event for an unknown
    // or not-yet-submitted session is a permanent bad event, not a
    // server fault. Surface 404 / 409 (not 500) so a real provider would
    // not retry it. `processPayment` re-locks and stays the source of
    // truth; an already-paid session passes through as an idempotent
    // no-op.
    const session = await findSessionById(parsed.data.sessionId);
    if (!session) {
      return withNoStore(
        jsonError({
          status: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: "Unknown session for this payment event.",
          requestId,
        }),
      );
    }
    if (session.status !== "submitted") {
      return withNoStore(
        jsonError({
          status: 409,
          code: ERROR_CODES.NOT_SUBMITTED,
          message: "Session has not been submitted; cannot grant entitlement.",
          requestId,
        }),
      );
    }

    const outcome = await processPayment(
      parsed.data.sessionId,
      parsed.data.idempotencyKey,
    );

    return withNoStore(
      NextResponse.json(
        { received: true, ...serializePayment(outcome) },
        { headers: { "x-request-id": requestId } },
      ),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "POST /api/v1/payments/webhook failed",
        requestId,
        err: err instanceof Error ? err.message : String(err),
      }),
    );
    return internalError(requestId);
  }
}

function tooLarge(requestId: string): NextResponse {
  return withNoStore(
    jsonError({
      status: 413,
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      message: `Request body exceeds ${MAX_BODY_BYTES} bytes.`,
      requestId,
    }),
  );
}
