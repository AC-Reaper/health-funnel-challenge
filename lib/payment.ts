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

// ---------- Decision tree (pure, already tested) ----------

export type PaymentAction =
  /** Same-key replay against a paid session. Return the existing payment. */
  | { type: "same_key_replay"; existing: Payment }
  /** New key against an already-paid session (ADR-012). No-op. */
  | { type: "already_paid_noop" }
  /** Same key against a not-yet-paid session (rare race). Flip + return existing. */
  | { type: "same_key_pre_paid"; existing: Payment }
  /** No prior row for this key. Insert + flip entitlement. */
  | { type: "insert_and_flip" }
  /** Session has not been submitted yet — pay must come after submit. */
  | { type: "not_submitted" };

export function decidePaymentAction(
  session: Pick<Session, "status" | "entitlementStatus">,
  existingForKey: Payment | null,
): PaymentAction {
  // Submit must precede pay (review-010 P1). The /pay route enforces
  // this at the API boundary with a 409 NOT_SUBMITTED envelope; this
  // branch is the matching guard in the pure state machine so the
  // orchestrator cannot accidentally mint a payment row against a
  // draft session.
  if (session.status !== "submitted") return { type: "not_submitted" };

  if (session.entitlementStatus === "paid") {
    return existingForKey
      ? { type: "same_key_replay", existing: existingForKey }
      : { type: "already_paid_noop" };
  }
  return existingForKey
    ? { type: "same_key_pre_paid", existing: existingForKey }
    : { type: "insert_and_flip" };
}

// ---------- Test seam (review-006 B001) ----------

export interface CreatePaymentInput {
  sessionId: string;
  idempotencyKey: string;
  amountCents: number;
  currency: string;
}

/**
 * Minimal structural interface over the Prisma transaction surface that
 * `runPaymentTransaction` uses. The real implementation builds it from
 * the `tx` inside `db.$transaction` (and runs `SELECT … FOR UPDATE`
 * upstream to serialize concurrent /pay calls). The test suite builds
 * an in-memory variant backed by Maps so the four-branch state machine
 * can be exercised without Supabase (review-006 B001).
 */
export interface PaymentTxOps {
  findSession(sessionId: string): Promise<Session | null>;
  findPaymentForKey(
    sessionId: string,
    idempotencyKey: string,
  ): Promise<Payment | null>;
  findFirstSucceededPayment(sessionId: string): Promise<Payment | null>;
  /** Throws `{ code: "P2002" }` if `(sessionId, idempotencyKey)` collides. */
  createPayment(input: CreatePaymentInput): Promise<Payment>;
  setEntitlementPaid(sessionId: string, paidAt: Date): Promise<Session>;
}

// ---------- Pure orchestration ----------

export async function runPaymentTransaction(
  ops: PaymentTxOps,
  sessionId: string,
  idempotencyKey: string,
  now: Date = new Date(),
): Promise<PaymentOutcome> {
  const session = await ops.findSession(sessionId);
  if (!session) throw new Error(`session not found: ${sessionId}`);

  const existingForKey = await ops.findPaymentForKey(sessionId, idempotencyKey);
  const action = decidePaymentAction(session, existingForKey);

  switch (action.type) {
    case "not_submitted":
      // Defensive — the route gate should have rejected this already.
      // Reaching here means the API layer regressed; surface as a 500
      // with requestId via the route's try/catch envelope.
      throw new Error(
        `session ${sessionId} is not submitted; /pay should be gated upstream`,
      );

    case "same_key_replay":
      return { session, payment: action.existing };

    case "already_paid_noop": {
      const existing = await ops.findFirstSucceededPayment(sessionId);
      if (!existing) {
        throw new Error(
          `session ${sessionId} is paid but no succeeded payment row exists`,
        );
      }
      return { session, payment: existing };
    }

    case "same_key_pre_paid": {
      const updated = await ops.setEntitlementPaid(sessionId, now);
      return { session: updated, payment: action.existing };
    }

    case "insert_and_flip": {
      let payment: Payment;
      try {
        payment = await ops.createPayment({
          sessionId,
          idempotencyKey,
          amountCents: AMOUNT_CENTS,
          currency: PAYMENT_CURRENCY,
        });
      } catch (err) {
        if (isPrismaUniqueViolation(err)) {
          const reread = await ops.findPaymentForKey(sessionId, idempotencyKey);
          if (!reread) throw err;
          payment = reread;
        } else {
          throw err;
        }
      }
      const updated = await ops.setEntitlementPaid(sessionId, now);
      return { session: updated, payment };
    }
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "P2002"
  );
}

// ---------- Prisma adapter ----------

function buildPaymentOpsFromTx(tx: Prisma.TransactionClient): PaymentTxOps {
  return {
    findSession: (sessionId) =>
      tx.session.findUnique({ where: { id: sessionId } }),
    findPaymentForKey: (sessionId, idempotencyKey) =>
      tx.payment.findUnique({
        where: { sessionId_idempotencyKey: { sessionId, idempotencyKey } },
      }),
    findFirstSucceededPayment: (sessionId) =>
      tx.payment.findFirst({
        where: { sessionId, status: "succeeded" },
        orderBy: { createdAt: "asc" },
      }),
    createPayment: (input) =>
      tx.payment.create({
        data: {
          sessionId: input.sessionId,
          idempotencyKey: input.idempotencyKey,
          status: "succeeded",
          amountCents: input.amountCents,
          currency: input.currency,
        },
      }),
    setEntitlementPaid: (sessionId, paidAt) =>
      tx.session.update({
        where: { id: sessionId },
        data: { entitlementStatus: "paid", paidAt },
      }),
  };
}

/**
 * Single-transaction mock payment. Implements ADR-006 (DB-enforced
 * idempotency via the (session_id, idempotency_key) UNIQUE) and
 * ADR-012 (silent no-op on already-paid + new key).
 *
 * `SELECT ... FOR UPDATE` serialises concurrent /pay calls per session
 * before the read so the decision branches see a consistent state.
 */
export async function processPayment(
  sessionId: string,
  idempotencyKey: string,
): Promise<PaymentOutcome> {
  return db.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "session" WHERE id = ${sessionId}::uuid FOR UPDATE
    `;
    if (lockedRows.length === 0) {
      throw new Error(`session not found: ${sessionId}`);
    }
    return runPaymentTransaction(
      buildPaymentOpsFromTx(tx),
      sessionId,
      idempotencyKey,
    );
  });
}

// ---------- Wire serialization ----------

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
