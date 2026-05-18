import { beforeEach, describe, expect, it } from "vitest";

import { Decimal } from "@prisma/client/runtime/library";
import type { Result, Session } from "@prisma/client";

import {
  type CreateResultInput,
  type SubmitTxOps,
  runSubmitTransaction,
} from "@/lib/result-repo";
import type { CalculatorOutput } from "@/lib/health/calculator";

// ---------- In-memory ops backing the test seam ----------

class InMemorySubmitOps implements SubmitTxOps {
  readonly results = new Map<string, Result>(); // keyed by sessionId
  readonly sessions = new Map<string, Session>(); // keyed by id

  /** Counts every createResult call (including ones that throw P2002). */
  createCalls = 0;

  seedSession(s: Session): void {
    this.sessions.set(s.id, s);
  }

  async findResult(sessionId: string): Promise<Result | null> {
    return this.results.get(sessionId) ?? null;
  }

  async createResult(input: CreateResultInput): Promise<Result> {
    this.createCalls += 1;
    if (this.results.has(input.sessionId)) {
      const err = new Error("Unique constraint violation");
      (err as { code?: string }).code = "P2002";
      throw err;
    }
    const row: Result = {
      id: `result_${this.results.size + 1}`,
      sessionId: input.sessionId,
      bmi: new Decimal(input.bmi) as unknown as Result["bmi"],
      bmiCategory: input.bmiCategory,
      dailyCaloriesKcal: input.dailyCaloriesKcal,
      predictedTargetDate: input.predictedTargetDate,
      curvePointsJson: input.curvePointsJson as Result["curvePointsJson"],
      planJson: input.planJson as Result["planJson"],
      algorithmVersion: input.algorithmVersion,
      computedAt: new Date(),
    };
    this.results.set(input.sessionId, row);
    return row;
  }

  async updateSessionToSubmitted(
    sessionId: string,
    submittedAt: Date,
  ): Promise<Session> {
    const cur = this.sessions.get(sessionId);
    if (!cur) throw new Error(`session not found: ${sessionId}`);
    const next: Session = {
      ...cur,
      status: "submitted",
      submittedAt,
      updatedAt: submittedAt,
    };
    this.sessions.set(sessionId, next);
    return next;
  }
}

function fakeSession(id = "sess_1", overrides: Partial<Session> = {}): Session {
  return {
    id,
    status: "draft",
    currentStep: "activity",
    entitlementStatus: "free",
    paidAt: null,
    submittedAt: null,
    createdAt: new Date("2026-05-19T09:00:00Z"),
    updatedAt: new Date("2026-05-19T09:30:00Z"),
    userAgent: null,
    ...overrides,
  };
}

function fakeCalcOutput(): CalculatorOutput {
  return {
    bmi: 22.4,
    bmiCategory: "normal",
    dailyCaloriesKcal: 1850,
    predictedTargetDate: new Date(Date.UTC(2026, 7, 12)),
    curvePoints: [
      { week: 0, weightKg: 80 },
      { week: 10, weightKg: 75 },
    ],
    plan: { summary: "Sustainable 0.5kg/week deficit.", note: null },
    algorithmVersion: "v1.0.0-mifflin",
  };
}

// ---------- Tests ----------

describe("runSubmitTransaction (review-006 B001)", () => {
  let ops: InMemorySubmitOps;

  beforeEach(() => {
    ops = new InMemorySubmitOps();
    ops.seedSession(fakeSession("sess_1"));
  });

  it("first submit: inserts result + flips session status", async () => {
    const outcome = await runSubmitTransaction(ops, "sess_1", fakeCalcOutput());
    expect(outcome.result.sessionId).toBe("sess_1");
    expect(ops.results.size).toBe(1);
    expect(outcome.session.status).toBe("submitted");
    expect(outcome.session.submittedAt).not.toBeNull();
    expect(ops.createCalls).toBe(1);
  });

  it("idempotent replay: second call returns the original result without a new insert", async () => {
    const first = await runSubmitTransaction(ops, "sess_1", fakeCalcOutput());
    const callsAfterFirst = ops.createCalls;

    const second = await runSubmitTransaction(ops, "sess_1", fakeCalcOutput());
    expect(second.result.id).toBe(first.result.id);
    expect(ops.results.size).toBe(1);
    // The second call still attempts the insert (P2002 path), but the
    // map still has exactly one result row — no duplicate persisted.
    expect(ops.createCalls).toBe(callsAfterFirst + 1);
  });

  it("recovers from a P2002 race by returning the existing row", async () => {
    // Simulate a racer that already wrote the row before this call runs.
    await ops.createResult({
      sessionId: "sess_1",
      bmi: 24,
      bmiCategory: "normal",
      dailyCaloriesKcal: 2000,
      predictedTargetDate: null,
      curvePointsJson: [],
      planJson: { summary: "racer", note: null },
      algorithmVersion: "v1.0.0-mifflin",
    });
    const existingId = ops.results.get("sess_1")!.id;

    const outcome = await runSubmitTransaction(ops, "sess_1", fakeCalcOutput());
    expect(outcome.result.id).toBe(existingId);
    expect(ops.results.size).toBe(1);
  });

  it("session.status flips to submitted in the same transaction", async () => {
    expect(ops.sessions.get("sess_1")!.status).toBe("draft");
    const outcome = await runSubmitTransaction(ops, "sess_1", fakeCalcOutput());
    expect(outcome.session.status).toBe("submitted");
    expect(ops.sessions.get("sess_1")!.status).toBe("submitted");
  });
});
