import { describe, expect, it } from "vitest";

import { AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/lib/payment";
import {
  WEBHOOK_PAYLOAD_SCHEMA,
  signWebhookPayload,
  validateWebhookPayload,
  verifyWebhookSignature,
} from "@/lib/payment-webhook";

const SECRET = "test-webhook-secret-test-webhook-secret-test-webhook";
const OTHER = "another-secret-another-secret-another-secret-xx";

function goodPayloadJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    eventType: "checkout.completed",
    sessionId: "00000000-0000-0000-0000-0000000000aa",
    idempotencyKey: "key-1",
    amountCents: AMOUNT_CENTS,
    currency: PAYMENT_CURRENCY,
    status: "succeeded",
    ...overrides,
  });
}

describe("signWebhookPayload / verifyWebhookSignature", () => {
  it("verifies a signature it produced (roundtrip)", () => {
    const raw = goodPayloadJson();
    const sig = signWebhookPayload(raw, SECRET);
    expect(sig.startsWith("sha256=")).toBe(true);
    expect(verifyWebhookSignature(raw, sig, SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signWebhookPayload(goodPayloadJson(), SECRET);
    expect(
      verifyWebhookSignature(goodPayloadJson({ amountCents: 1 }), sig, SECRET),
    ).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const raw = goodPayloadJson();
    const sig = signWebhookPayload(raw, OTHER);
    expect(verifyWebhookSignature(raw, sig, SECRET)).toBe(false);
  });

  it("rejects a missing, prefix-less, or length-mismatched signature", () => {
    const raw = goodPayloadJson();
    expect(verifyWebhookSignature(raw, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(raw, "deadbeef", SECRET)).toBe(false); // no sha256= prefix
    expect(verifyWebhookSignature(raw, "sha256=abc", SECRET)).toBe(false); // wrong length
  });
});

describe("WEBHOOK_PAYLOAD_SCHEMA", () => {
  it("accepts a well-formed payload", () => {
    expect(
      WEBHOOK_PAYLOAD_SCHEMA.safeParse(JSON.parse(goodPayloadJson())).success,
    ).toBe(true);
  });

  it("rejects unknown keys (.strict)", () => {
    expect(
      WEBHOOK_PAYLOAD_SCHEMA.safeParse({
        ...JSON.parse(goodPayloadJson()),
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("rejects a wrong eventType or non-succeeded status", () => {
    expect(
      WEBHOOK_PAYLOAD_SCHEMA.safeParse(
        JSON.parse(goodPayloadJson({ eventType: "checkout.expired" })),
      ).success,
    ).toBe(false);
    expect(
      WEBHOOK_PAYLOAD_SCHEMA.safeParse(
        JSON.parse(goodPayloadJson({ status: "failed" })),
      ).success,
    ).toBe(false);
  });

  it("reuses the printable-ASCII hardening for idempotencyKey (review-009)", () => {
    // The webhook is the only grant path — it must not accept the input
    // class the old /pay route deliberately closed.
    for (const badKey of ["bad\nkey", "bad\u0000key", "non\u00e9ascii"]) {
      expect(
        WEBHOOK_PAYLOAD_SCHEMA.safeParse({
          ...JSON.parse(goodPayloadJson()),
          idempotencyKey: badKey,
        }).success,
      ).toBe(false);
    }
    // A clean printable-ASCII key still passes.
    expect(
      WEBHOOK_PAYLOAD_SCHEMA.safeParse({
        ...JSON.parse(goodPayloadJson()),
        idempotencyKey: "ok-key-123",
      }).success,
    ).toBe(true);
  });
});

describe("validateWebhookPayload", () => {
  const base = WEBHOOK_PAYLOAD_SCHEMA.parse(JSON.parse(goodPayloadJson()));

  it("passes for the canonical amount + currency + succeeded", () => {
    expect(validateWebhookPayload(base)).toEqual({ ok: true });
  });

  it("rejects an amount that doesn't match the server price", () => {
    const out = validateWebhookPayload({ ...base, amountCents: 1 });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toMatch(/amount mismatch/);
  });

  it("rejects a currency that doesn't match", () => {
    const out = validateWebhookPayload({ ...base, currency: "EUR" });
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.reason).toMatch(/currency mismatch/);
  });
});
