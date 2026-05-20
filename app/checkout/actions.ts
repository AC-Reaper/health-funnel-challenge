"use server";

import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { internalUrl } from "@/lib/internal-fetch";
import { env } from "@/lib/env";
import { AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/lib/payment";
import { signWebhookPayload } from "@/lib/payment-webhook";
import { COOKIE_NAME, verifyCookie } from "@/lib/session";

/**
 * Mock payment-provider confirmation (ADR-017). This server action plays
 * the *provider*: it is the only place that holds `PAYMENT_WEBHOOK_SECRET`
 * and signs the callback. It posts a signed `checkout.completed` event to
 * `/api/v1/payments/webhook`, which verifies the signature + amount +
 * currency before granting entitlement. The browser never sees the
 * secret or the signature.
 */
export async function confirmMockPayment(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);
  if (!sid) return { ok: false, error: "No active session." };

  const payload = {
    eventType: "checkout.completed" as const,
    sessionId: sid,
    idempotencyKey: randomUUID(),
    amountCents: AMOUNT_CENTS,
    currency: PAYMENT_CURRENCY,
    status: "succeeded" as const,
  };
  const rawBody = JSON.stringify(payload);
  const signature = signWebhookPayload(rawBody, env.PAYMENT_WEBHOOK_SECRET);

  const res = await fetch(await internalUrl("/api/v1/payments/webhook"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Signature": signature,
    },
    body: rawBody,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    return {
      ok: false,
      error: body.error?.message ?? `Provider callback failed (${res.status}).`,
    };
  }
  return { ok: true };
}
