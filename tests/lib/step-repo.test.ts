import { beforeEach, describe, expect, it } from "vitest";

import { Decimal } from "@prisma/client/runtime/library";
import type { Assessment, Session, StepKey } from "@prisma/client";

import {
  type CreateStepEventInput,
  type StepsTxOps,
  runStepsTransaction,
} from "@/lib/step-repo";
import type { StepBody } from "@/lib/validation/steps";

// ---------- In-memory ops backing the test seam ----------

interface StepEventRow {
  sessionId: string;
  stepKey: StepKey;
  valueJson: unknown;
  createdAt: Date;
}

class InMemoryStepsOps implements StepsTxOps {
  readonly assessments = new Map<string, Assessment>();
  readonly sessions = new Map<string, Session>();
  readonly stepEvents: StepEventRow[] = [];

  /** Counts every createStepEvent call (including ones that throw). */
  createStepEventCalls = 0;

  /**
   * If set, the next call to `upsertAssessmentField` throws this error
   * instead of writing. Used to simulate a Prisma-level failure during
   * the upsert and prove `createStepEvent` is never called downstream.
   */
  throwOnUpsert: Error | null = null;

  seedSession(s: Session): void {
    this.sessions.set(s.id, s);
  }

  async upsertAssessmentField<K extends StepKey>(
    sessionId: string,
    stepKey: K,
    patch: StepBody[K],
  ): Promise<Assessment> {
    if (this.throwOnUpsert) {
      const err = this.throwOnUpsert;
      this.throwOnUpsert = null;
      throw err;
    }

    const existing = this.assessments.get(sessionId);
    const base: Assessment = existing ?? {
      sessionId,
      gender: null,
      mainGoal: null,
      ageYears: null,
      heightCm: null,
      weightKg: null,
      targetWeightKg: null,
      activityLevel: null,
      updatedAt: new Date("2026-05-19T00:00:00.000Z"),
    };

    const next: Assessment = { ...base, updatedAt: new Date() };
    switch (stepKey) {
      case "gender":
        next.gender = (patch as StepBody["gender"]).gender;
        break;
      case "main_goal":
        next.mainGoal = (patch as StepBody["main_goal"]).mainGoal;
        break;
      case "age":
        next.ageYears = (patch as StepBody["age"]).ageYears;
        break;
      case "height":
        next.heightCm = (patch as StepBody["height"]).heightCm;
        break;
      case "weight": {
        const w = patch as StepBody["weight"];
        next.weightKg = new Decimal(w.weightKg) as unknown as Assessment["weightKg"];
        next.targetWeightKg = new Decimal(
          w.targetWeightKg,
        ) as unknown as Assessment["targetWeightKg"];
        break;
      }
      case "activity":
        next.activityLevel = (patch as StepBody["activity"]).activityLevel;
        break;
    }
    this.assessments.set(sessionId, next);
    return next;
  }

  async updateSessionCurrentStep(
    sessionId: string,
    currentStep: StepKey,
  ): Promise<Session> {
    const cur = this.sessions.get(sessionId);
    if (!cur) throw new Error(`session not found: ${sessionId}`);
    const next: Session = {
      ...cur,
      currentStep,
      updatedAt: new Date(),
    };
    this.sessions.set(sessionId, next);
    return next;
  }

  async createStepEvent(input: CreateStepEventInput): Promise<void> {
    this.createStepEventCalls += 1;
    this.stepEvents.push({
      sessionId: input.sessionId,
      stepKey: input.stepKey,
      valueJson: input.valueJson,
      createdAt: new Date(),
    });
  }
}

function fakeSession(id = "sess_1", overrides: Partial<Session> = {}): Session {
  return {
    id,
    status: "draft",
    currentStep: "gender",
    entitlementStatus: "free",
    paidAt: null,
    submittedAt: null,
    createdAt: new Date("2026-05-19T09:00:00Z"),
    updatedAt: new Date("2026-05-19T09:30:00Z"),
    userAgent: null,
    ...overrides,
  };
}

// ---------- Tests ----------

describe("runStepsTransaction (review-004-final N001)", () => {
  let ops: InMemoryStepsOps;

  beforeEach(() => {
    ops = new InMemoryStepsOps();
    ops.seedSession(fakeSession("sess_1"));
  });

  it("successful PATCH writes assessment + advances currentStep + appends step_event", async () => {
    const outcome = await runStepsTransaction(ops, "sess_1", "gender", {
      gender: "female",
    });

    expect(outcome.assessment.gender).toBe("female");
    expect(outcome.session.currentStep).toBe("main_goal");
    expect(ops.stepEvents).toHaveLength(1);
    expect(ops.stepEvents[0]).toMatchObject({
      sessionId: "sess_1",
      stepKey: "gender",
      valueJson: { gender: "female" },
    });
  });

  it("weight step records both fields verbatim in step_event.valueJson", async () => {
    await runStepsTransaction(ops, "sess_1", "weight", {
      weightKg: 80,
      targetWeightKg: 70,
    });

    expect(ops.stepEvents).toHaveLength(1);
    expect(ops.stepEvents[0]!.valueJson).toEqual({
      weightKg: 80,
      targetWeightKg: 70,
    });
    expect(ops.stepEvents[0]!.stepKey).toBe("weight");
  });

  it("if assessment upsert throws, step_event is never written (single-tx semantics)", async () => {
    ops.throwOnUpsert = new Error("simulated Prisma failure");

    await expect(
      runStepsTransaction(ops, "sess_1", "gender", { gender: "female" }),
    ).rejects.toThrow(/simulated Prisma failure/);

    // In production the surrounding db.$transaction would roll back any
    // partial writes. The in-memory ops just prove the orchestrator
    // never reaches createStepEvent after the upsert fails.
    expect(ops.createStepEventCalls).toBe(0);
    expect(ops.stepEvents).toHaveLength(0);
  });
});
