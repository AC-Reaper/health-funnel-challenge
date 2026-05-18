import { describe, expect, it } from "vitest";

import { decidePaymentAction } from "@/lib/payment";

import type { Payment } from "@prisma/client";

function fakePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "00000000-0000-0000-0000-00000000000a",
    sessionId: "00000000-0000-0000-0000-00000000000b",
    idempotencyKey: "k-1",
    status: "succeeded",
    amountCents: 999,
    currency: "USD",
    createdAt: new Date("2026-05-18T10:00:00.000Z"),
    ...overrides,
  };
}

describe("decidePaymentAction", () => {
  describe("session is already paid (ADR-012)", () => {
    it("same key with an existing payment → same_key_replay", () => {
      const p = fakePayment();
      const action = decidePaymentAction({ entitlementStatus: "paid" }, p);
      expect(action).toEqual({ type: "same_key_replay", existing: p });
    });

    it("new key with no matching payment → already_paid_noop", () => {
      const action = decidePaymentAction(
        { entitlementStatus: "paid" },
        null,
      );
      expect(action).toEqual({ type: "already_paid_noop" });
    });
  });

  describe("session is free (first-time pay)", () => {
    it("no existing payment for this key → insert_and_flip", () => {
      const action = decidePaymentAction(
        { entitlementStatus: "free" },
        null,
      );
      expect(action).toEqual({ type: "insert_and_flip" });
    });

    it("an existing payment for this key (rare race) → same_key_pre_paid", () => {
      const p = fakePayment();
      const action = decidePaymentAction(
        { entitlementStatus: "free" },
        p,
      );
      expect(action).toEqual({ type: "same_key_pre_paid", existing: p });
    });
  });
});
