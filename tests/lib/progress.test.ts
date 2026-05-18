import { describe, expect, it } from "vitest";

import { STEP_ORDER, computeCurrentStep } from "@/lib/progress";

import type { Assessment } from "@prisma/client";

function emptyAssessment(): Assessment {
  return {
    sessionId: "00000000-0000-0000-0000-000000000000",
    gender: null,
    mainGoal: null,
    ageYears: null,
    heightCm: null,
    weightKg: null,
    targetWeightKg: null,
    activityLevel: null,
    updatedAt: new Date(),
  };
}

describe("STEP_ORDER", () => {
  it("contains the 6 funnel steps in canonical order", () => {
    expect([...STEP_ORDER]).toEqual([
      "gender",
      "main_goal",
      "age",
      "height",
      "weight",
      "activity",
    ]);
  });
});

describe("computeCurrentStep", () => {
  it('returns "gender" when assessment is null', () => {
    expect(computeCurrentStep(null)).toBe("gender");
  });

  it('returns "gender" on an empty assessment row', () => {
    expect(computeCurrentStep(emptyAssessment())).toBe("gender");
  });

  it("returns the first incomplete step when earlier steps are filled", () => {
    const a = emptyAssessment();
    a.gender = "female";
    expect(computeCurrentStep(a)).toBe("main_goal");

    a.mainGoal = "lose_weight";
    expect(computeCurrentStep(a)).toBe("age");

    a.ageYears = 29;
    expect(computeCurrentStep(a)).toBe("height");

    a.heightCm = 168;
    expect(computeCurrentStep(a)).toBe("weight");
  });

  it('weight step requires BOTH weightKg and targetWeightKg', () => {
    const a = emptyAssessment();
    a.gender = "female";
    a.mainGoal = "lose_weight";
    a.ageYears = 29;
    a.heightCm = 168;
    a.weightKg = "80" as unknown as Assessment["weightKg"];
    // targetWeightKg still null -> weight step still incomplete
    expect(computeCurrentStep(a)).toBe("weight");

    a.targetWeightKg = "70" as unknown as Assessment["targetWeightKg"];
    expect(computeCurrentStep(a)).toBe("activity");
  });

  it('returns "activity" (the last step) on a fully populated assessment', () => {
    const a = emptyAssessment();
    a.gender = "female";
    a.mainGoal = "lose_weight";
    a.ageYears = 29;
    a.heightCm = 168;
    a.weightKg = "80" as unknown as Assessment["weightKg"];
    a.targetWeightKg = "70" as unknown as Assessment["targetWeightKg"];
    a.activityLevel = "moderate";
    expect(computeCurrentStep(a)).toBe("activity");
  });
});
