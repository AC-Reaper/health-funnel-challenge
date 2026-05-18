import "server-only";

import type { Payment, Prisma, Session } from "@prisma/client";

import { db } from "./db";
import { CURRENCY, PRICE_CENTS } from "./serializers/result";

export const AMOUNT_CENTS = PRICE_CENTS;
export const PAYMENT_CURRENCY = CURRENCY;

export interface PaymentOutcome {
  session: Session;
  payment: Payment;
}

/**
 * Decision tree for the /pay handler, kept pure for unit-testing.
 * Inputs: the current session row + the payment row (if any) that
 * matches the request's idempotency key. Outputs the action the
 * transaction should take next.
 */
export type PaymentAction =
  /** Same-key replay against a paid session. Return the existing payment. */
  | { type: "same_key_replay"; existing: Payment }
  /** New key against an already-paid session (ADR-012). No-op. */
  | { type: "already_paid_noop" }
  /** Same key against a not-yet-paid session (rare race). Re-read after insert. */
  | { type: "same_key_pre_paid"; existing: Payment }
  /** No prior row for this key. Insert + flip entitlement. */
  | { type: "insert_and_flip" };

export function decidePaymentAction(
  session: Pick<Session, "entitlementStatus">,
  existingForKey: Payment | null,
): PaymentAction {
  if (session.entitlementStatus === "paid") {
    return existingForKey
      ? { type: "same_key_replay", existing: existingForKey }
      : { type: "already_paid_noop" };
  }
  return existingForKey
    ? { type: "same_key_pre_paid", existing: existingForKey }
    : { type: "insert_and_flip" };
}

/**
 * Single-transaction mock payment. Implements ADR-006 (DB-enforced
 * idempotency via the (session_id, idempotency_key) UNIQUE) and
 * ADR-012 (silent no-op on already-paid + new key).
 */
export async function processPayment(
  sessionId: string,
  idempotencyKey: string,
): Promise<PaymentOutcome> {
  return db.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE serializes concurrent /pay calls per session.
    const lockedRows = await tx.$queryRaw<
      { id: string; entitlement_status: "free" | "paid" }[]
    >`SELECT id, entitlement_status FROM "session" WHERE id = ${sessionId}::uuid FOR UPDATE`;
    const locked = lockedRows[0];
    if (!locked) {
      // Session was deleted between the route's findSessionById and now.
      // The route handler treats this as 401 NO_SESSION upstream; here we
      // just propagate the error.
      throw new Error(`session not found: ${sessionId}`);
    }

    const session = (await tx.session.findUnique({
      where: { id: sessionId },
    }))!;

    const existingForKey = await tx.payment.findUnique({
      where: {
        sessionId_idempotencyKey: { sessionId, idempotencyKey },
      },
    });

    const action = decidePaymentAction(session, existingForKey);

    switch (action.type) {
      case "same_key_replay":
        return { session, payment: action.existing };

      case "already_paid_noop": {
        // The contract returns *a* payment row in the response. The only
        // existing payment(s) on this session are for *other* keys. Pick
        // the first succeeded one (there is at most one by the partial
        // unique index payment_one_success_per_session_idx).
        const existing = await tx.payment.findFirst({
          where: { sessionId, status: "succeeded" },
          orderBy: { createdAt: "asc" },
        });
        if (!existing) {
          throw new Error(
            `session ${sessionId} is paid but no succeeded payment row exists`,
          );
        }
        return { session, payment: existing };
      }

      case "same_key_pre_paid": {
        // The earlier insert went through but the entitlement flip did
        // not commit. Re-attempt the flip and return the existing row.
        const updated = await tx.session.update({
          where: { id: sessionId },
          data: { entitlementStatus: "paid", paidAt: new Date() },
        });
        return { session: updated, payment: action.existing };
      }

      case "insert_and_flip": {
        let payment: Payment;
        try {
          payment = await tx.payment.create({
            data: {
              sessionId,
              idempotencyKey,
              status: "succeeded",
              amountCents: AMOUNT_CENTS,
              currency: PAYMENT_CURRENCY,
            },
          });
        } catch (err) {
          if (isPrismaUniqueViolation(err)) {
            const reread = await tx.payment.findUnique({
              where: {
                sessionId_idempotencyKey: { sessionId, idempotencyKey },
              },
            });
            if (!reread) throw err;
            payment = reread;
          } else {
            throw err;
          }
        }
        const updated = await tx.session.update({
          where: { id: sessionId },
          data: { entitlementStatus: "paid", paidAt: new Date() },
        });
        return { session: updated, payment };
      }
    }
  });
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

export function serializePayment(outcome: PaymentOutcome): {
  paymentId: string;
  sessionId: string;
  status: "succeeded" | "failed";
  amountCents: number;
  currency: string;
  entitlementStatus: "free" | "paid";
  paidAt: string | null;
} {
  return {
    paymentId: outcome.payment.id,
    sessionId: outcome.session.id,
    status: outcome.payment.status,
    amountCents: outcome.payment.amountCents,
    currency: outcome.payment.currency,
    entitlementStatus: outcome.session.entitlementStatus,
    paidAt: outcome.session.paidAt ? outcome.session.paidAt.toISOString() : null,
  };
}

// Silence "unused" warning when no consumer is referencing the namespace.
export type { Prisma };
