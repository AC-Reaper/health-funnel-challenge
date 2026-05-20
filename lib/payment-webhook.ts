import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { AMOUNT_CENTS, PAYMENT_CURRENCY } from "./payment";

/**
 * Simulated payment-provider webhook (ADR-017).
 *
 * Entitlement is granted ONLY by `/api/v1/payments/webhook`, and only
 * when the request carries a valid HMAC signature over the raw body
 * (the `PAYMENT_WEBHOOK_SECRET` lives server-side, never in the
 * browser). This mirrors Stripe's `stripe-signature` model: the
 * merchant's browser-facing checkout endpoint cannot mint `paid`; only
 * the provider's signed callback can. No real provider is integrated —
 * the `/checkout` mock-provider page plays the provider and signs the
 * callback with this same secret.
 *
 * The functions here are pure (no I/O) so the verify / validate logic is
 * unit-tested without a DB or network.
 */

const SIG_PREFIX = "sha256=";

/** `sha256=<hex>` HMAC-SHA256 of the exact raw body bytes. */
export function signWebhookPayload(rawBody: string, secret: string): string {
  const hex = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `${SIG_PREFIX}${hex}`;
}

/**
 * Constant-time verification of an `X-Payment-Signature` header against
 * the raw body. Returns false for a missing/malformed/length-mismatched
 * header rather than throwing, so the route maps it to 401.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIG_PREFIX)) {
    return false;
  }
  const expected = signWebhookPayload(rawBody, secret);
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch — guard first (the length
  // of an HMAC-hex string is fixed, so this leaks nothing useful).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The provider's `checkout.completed` event body. `.strict()` rejects
 * unknown keys; the route re-checks amount/currency/status against the
 * server's own price constants in `validateWebhookPayload`.
 */
export const WEBHOOK_PAYLOAD_SCHEMA = z
  .object({
    eventType: z.literal("checkout.completed"),
    sessionId: z.string().uuid(),
    idempotencyKey: z.string().min(1).max(128),
    amountCents: z.number().int(),
    currency: z.string(),
    status: z.literal("succeeded"),
  })
  .strict();

export type WebhookPayload = z.infer<typeof WEBHOOK_PAYLOAD_SCHEMA>;

/**
 * Order checks the real provider callback would enforce: the paid amount
 * and currency must match the order we created, and the event must be a
 * success. We compare against the server's canonical price constants —
 * the source of truth — so a tampered (but validly-signed) payload that
 * understates the amount is rejected.
 */
export function validateWebhookPayload(
  payload: WebhookPayload,
): { ok: true } | { ok: false; reason: string } {
  if (payload.status !== "succeeded") {
    return { ok: false, reason: `unexpected status: ${payload.status}` };
  }
  if (payload.amountCents !== AMOUNT_CENTS) {
    return {
      ok: false,
      reason: `amount mismatch: expected ${AMOUNT_CENTS}, got ${payload.amountCents}`,
    };
  }
  if (payload.currency !== PAYMENT_CURRENCY) {
    return {
      ok: false,
      reason: `currency mismatch: expected ${PAYMENT_CURRENCY}, got ${payload.currency}`,
    };
  }
  return { ok: true };
}
