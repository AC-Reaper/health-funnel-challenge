import { beforeEach, describe, expect, it } from "vitest";

import type { Payment, Session } from "@prisma/client";

import {
  AMOUNT_CENTS,
  PAYMENT_CURRENCY,
  type CreatePaymentInput,
  type PaymentTxOps,
  decidePaymentAction,
  runPaymentTransaction,
} from "@/lib/payment";

// ---------- decidePaymentAction (pure decision tree) ----------

function fakePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "00000000-0000-0000-0000-00000000000a",
    sessionId: "00000000-0000-0000-0000-00000000000b",
    idempotencyKey: "k-1",
    status: "succeeded",
    amountCents: 999,
    currency: "USD",
    createdAt: new Date("2026-05-19T10:00:00.000Z"),
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

// ---------- runPaymentTransaction (full state machine, review-006 B001) ----------

class InMemoryPaymentOps implements PaymentTxOps {
  readonly sessions = new Map<string, Session>();
  readonly payments: Payment[] = [];
  createCalls = 0;
  setEntitlementCalls = 0;

  seedSession(s: Session): void {
    this.sessions.set(s.id, s);
  }

  async findSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async findPaymentForKey(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<Payment | null> {
    return (
      this.payments.find(
        (p) => p.sessionId === sessionId && p.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async findFirstSucceededPayment(sessionId: string): Promise<Payment | null> {
    return (
      this.payments
        .filter((p) => p.sessionId === sessionId && p.status === "succeeded")
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    this.createCalls += 1;
    const collision = this.payments.find(
      (p) =>
        p.sessionId === input.sessionId &&
        p.idempotencyKey === input.idempotencyKey,
    );
    if (collision) {
      const err = new Error("Unique constraint violation");
      (err as { code?: string }).code = "P2002";
      throw err;
    }
    const row: Payment = {
      id: `pay_${this.payments.length + 1}`,
      sessionId: input.sessionId,
      idempotencyKey: input.idempotencyKey,
      status: "succeeded",
      amountCents: input.amountCents,
      currency: input.currency,
      createdAt: new Date("2026-05-19T11:00:00.000Z"),
    };
    this.payments.push(row);
    return row;
  }

  async setEntitlementPaid(sessionId: string, paidAt: Date): Promise<Session> {
    this.setEntitlementCalls += 1;
    const cur = this.sessions.get(sessionId);
    if (!cur) throw new Error(`session not found: ${sessionId}`);
    const next: Session = {
      ...cur,
      entitlementStatus: "paid",
      paidAt,
      updatedAt: paidAt,
    };
    this.sessions.set(sessionId, next);
    return next;
  }
}

function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess_1",
    status: "submitted",
    currentStep: "activity",
    entitlementStatus: "free",
    paidAt: null,
    submittedAt: new Date("2026-05-19T10:30:00Z"),
    createdAt: new Date("2026-05-19T09:00:00Z"),
    updatedAt: new Date("2026-05-19T10:30:00Z"),
    userAgent: null,
    ...overrides,
  };
}

describe("runPaymentTransaction (review-006 B001)", () => {
  let ops: InMemoryPaymentOps;

  beforeEach(() => {
    ops = new InMemoryPaymentOps();
  });

  it("free + no row for key → insert succeeded payment + flip entitlement", async () => {
    ops.seedSession(fakeSession());
    const outcome = await runPaymentTransaction(ops, "sess_1", "key-a");

    expect(ops.payments).toHaveLength(1);
    expect(ops.payments[0]!.status).toBe("succeeded");
    expect(ops.payments[0]!.amountCents).toBe(AMOUNT_CENTS);
    expect(ops.payments[0]!.currency).toBe(PAYMENT_CURRENCY);
    expect(outcome.session.entitlementStatus).toBe("paid");
    expect(outcome.session.paidAt).not.toBeNull();
    expect(outcome.payment.id).toBe(ops.payments[0]!.id);
  });

  it("idempotent same-key replay → no second row, same paymentId", async () => {
    ops.seedSession(fakeSession());
    const first = await runPaymentTransaction(ops, "sess_1", "key-a");
    const second = await runPaymentTransaction(ops, "sess_1", "key-a");

    expect(ops.payments).toHaveLength(1);
    expect(second.payment.id).toBe(first.payment.id);
    expect(second.session.entitlementStatus).toBe("paid");
  });

  it("already-paid + NEW key → silent no-op, no second payment row (ADR-012)", async () => {
    ops.seedSession(fakeSession());
    const first = await runPaymentTransaction(ops, "sess_1", "key-a");
    const createsAfterFirst = ops.createCalls;

    const second = await runPaymentTransaction(ops, "sess_1", "key-b");

    expect(ops.payments).toHaveLength(1);
    expect(second.payment.id).toBe(first.payment.id);
    expect(second.session.entitlementStatus).toBe("paid");
    // The no-op branch does not call createPayment at all.
    expect(ops.createCalls).toBe(createsAfterFirst);
  });

  it("same-key + free (rare race recovery) → flips entitlement, returns existing payment", async () => {
    // Seed an existing payment row for the key while the session is still free.
    const session = fakeSession();
    ops.seedSession(session);
    const existing = await ops.createPayment({
      sessionId: session.id,
      idempotencyKey: "key-a",
      amountCents: AMOUNT_CENTS,
      currency: PAYMENT_CURRENCY,
    });
    const createsAfterSeed = ops.createCalls;
    expect(ops.sessions.get(session.id)!.entitlementStatus).toBe("free");

    const outcome = await runPaymentTransaction(ops, session.id, "key-a");

    expect(outcome.payment.id).toBe(existing.id);
    expect(outcome.session.entitlementStatus).toBe("paid");
    expect(ops.payments).toHaveLength(1);
    expect(ops.createCalls).toBe(createsAfterSeed); // no new createPayment call
  });

  it("recovers from a P2002 race during insert by re-reading the existing row", async () => {
    // Simulate a different test path: the seeded row uses the SAME key
    // the runner is about to try, AFTER decidePaymentAction has already
    // observed a free session + null existingForKey. We model this by
    // sneaking the row in via a custom ops variant.
    class RacingOps extends InMemoryPaymentOps {
      private firstPaymentLookup = true;
      override async findPaymentForKey(
        sessionId: string,
        idempotencyKey: string,
      ): Promise<Payment | null> {
        if (this.firstPaymentLookup) {
          this.firstPaymentLookup = false;
          return null; // decision-tree sees no row -> insert_and_flip
        }
        return super.findPaymentForKey(sessionId, idempotencyKey);
      }
      override async createPayment(input: CreatePaymentInput): Promise<Payment> {
        // Insert a racer row first, then try the real insert (will collide).
        if (this.payments.length === 0) {
          await super.createPayment(input);
        }
        return super.createPayment(input);
      }
    }
    const racing = new RacingOps();
    racing.seedSession(fakeSession());

    const outcome = await runPaymentTransaction(racing, "sess_1", "key-a");

    expect(racing.payments).toHaveLength(1);
    expect(outcome.payment.id).toBe(racing.payments[0]!.id);
    expect(outcome.session.entitlementStatus).toBe("paid");
  });
});
