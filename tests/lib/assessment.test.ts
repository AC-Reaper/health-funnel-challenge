import { describe, expect, it } from "vitest";

import {
  checkWeightCoherence,
  firstMissingPrereq,
  projectAssessment,
  stepIsFilled,
  type ProjectedAssessment,
} from "@/lib/assessment";
import { STEP_ORDER } from "@/lib/progress";

import type { Assessment, StepKey } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function emptyAssessment(sessionId = "11111111-1111-1111-1111-111111111111"): Assessment {
  return {
    sessionId,
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

function emptyProjected(): ProjectedAssessment {
  return {
    gender: null,
    mainGoal: null,
    ageYears: null,
    heightCm: null,
    weightKg: null,
    targetWeightKg: null,
    activityLevel: null,
  };
}

// ---------- projectAssessment ----------

describe("projectAssessment", () => {
  it("writes only the target step's columns, leaves others null when current=null", () => {
    const p = projectAssessment(null, "gender", { gender: "female" });
    expect(p.gender).toBe("female");
    expect(p.mainGoal).toBeNull();
    expect(p.ageYears).toBeNull();
    expect(p.activityLevel).toBeNull();
  });

  it("preserves existing fields when patching a single step", () => {
    const cur = emptyAssessment();
    cur.gender = "female";
    cur.mainGoal = "lose_weight";
    const p = projectAssessment(cur, "age", { ageYears: 29 });
    expect(p.gender).toBe("female");
    expect(p.mainGoal).toBe("lose_weight");
    expect(p.ageYears).toBe(29);
  });

  it("overwrites the targeted step on re-edit", () => {
    const cur = emptyAssessment();
    cur.gender = "female";
    cur.mainGoal = "lose_weight";
    const p = projectAssessment(cur, "gender", { gender: "male" });
    expect(p.gender).toBe("male");
    expect(p.mainGoal).toBe("lose_weight");
  });

  it("coerces Prisma Decimal weight columns to numbers", () => {
    const cur = emptyAssessment();
    cur.weightKg = new Decimal("80.5") as unknown as Assessment["weightKg"];
    cur.targetWeightKg = new Decimal("70.0") as unknown as Assessment["targetWeightKg"];
    const p = projectAssessment(cur, "age", { ageYears: 29 });
    expect(p.weightKg).toBe(80.5);
    expect(p.targetWeightKg).toBe(70);
  });

  it("writes both weight fields together when stepKey='weight'", () => {
    const cur = emptyAssessment();
    cur.gender = "female";
    cur.mainGoal = "lose_weight";
    const p = projectAssessment(cur, "weight", {
      weightKg: 80,
      targetWeightKg: 70,
    });
    expect(p.weightKg).toBe(80);
    expect(p.targetWeightKg).toBe(70);
    expect(p.mainGoal).toBe("lose_weight");
  });
});

// ---------- stepIsFilled ----------

describe("stepIsFilled", () => {
  it("returns false for every step on an empty projection", () => {
    const p = emptyProjected();
    for (const step of STEP_ORDER) {
      expect(stepIsFilled(p, step)).toBe(false);
    }
  });

  it("treats weight as filled only when BOTH weightKg and targetWeightKg are set", () => {
    const p = emptyProjected();
    p.weightKg = 80;
    expect(stepIsFilled(p, "weight")).toBe(false);
    p.targetWeightKg = 70;
    expect(stepIsFilled(p, "weight")).toBe(true);
  });

  it("recognises each step individually", () => {
    const cases: Array<[StepKey, keyof ProjectedAssessment, unknown]> = [
      ["gender", "gender", "female"],
      ["main_goal", "mainGoal", "lose_weight"],
      ["age", "ageYears", 29],
      ["height", "heightCm", 168],
      ["activity", "activityLevel", "moderate"],
    ];
    for (const [step, field, value] of cases) {
      const p = emptyProjected();
      (p as Record<string, unknown>)[field] = value;
      expect(stepIsFilled(p, step)).toBe(true);
    }
  });
});

// ---------- firstMissingPrereq ----------

describe("firstMissingPrereq", () => {
  it("returns null when saving the very first step on an empty projection", () => {
    expect(firstMissingPrereq("gender", emptyProjected(), STEP_ORDER)).toBeNull();
  });

  it('reports the first gap when saving "activity" before earlier steps', () => {
    const p = emptyProjected();
    p.gender = "female";
    p.mainGoal = "lose_weight";
    expect(firstMissingPrereq("activity", p, STEP_ORDER)).toBe("age");
  });

  it("walks past filled prereqs to find the first hole", () => {
    const p = emptyProjected();
    p.gender = "female";
    p.mainGoal = "lose_weight";
    p.ageYears = 29;
    expect(firstMissingPrereq("weight", p, STEP_ORDER)).toBe("height");
  });

  it("allows editing an already-completed earlier step", () => {
    const p = emptyProjected();
    p.gender = "male";
    p.mainGoal = "lose_weight";
    p.ageYears = 29;
    p.heightCm = 168;
    p.weightKg = 80;
    p.targetWeightKg = 70;
    p.activityLevel = "moderate";
    // Re-editing `gender` with everything else filled is allowed.
    expect(firstMissingPrereq("gender", p, STEP_ORDER)).toBeNull();
  });

  it("returns null when no prereq is missing (saving the last step in a full projection)", () => {
    const p = emptyProjected();
    p.gender = "female";
    p.mainGoal = "lose_weight";
    p.ageYears = 29;
    p.heightCm = 168;
    p.weightKg = 80;
    p.targetWeightKg = 70;
    expect(firstMissingPrereq("activity", p, STEP_ORDER)).toBeNull();
  });
});

// ---------- checkWeightCoherence ----------

describe("checkWeightCoherence", () => {
  describe("lose_weight", () => {
    it("rejects target == current", () => {
      expect(checkWeightCoherence("lose_weight", 80, 80)).not.toBeNull();
    });
    it("rejects target > current", () => {
      expect(checkWeightCoherence("lose_weight", 80, 81)).not.toBeNull();
    });
    it("accepts target < current", () => {
      expect(checkWeightCoherence("lose_weight", 80, 70)).toBeNull();
    });
    it("returns both weightKg and targetWeightKg messages on violation", () => {
      const v = checkWeightCoherence("lose_weight", 80, 90);
      expect(v).not.toBeNull();
      expect(v?.fields.weightKg).toContain("lose_weight");
      expect(v?.fields.weightKg).toContain("80");
      expect(v?.fields.weightKg).toContain("90");
      expect(v?.fields.targetWeightKg).toContain("less than");
    });
  });

  describe("gain_weight", () => {
    it("rejects target == current", () => {
      expect(checkWeightCoherence("gain_weight", 70, 70)).not.toBeNull();
    });
    it("rejects target < current", () => {
      expect(checkWeightCoherence("gain_weight", 70, 69)).not.toBeNull();
    });
    it("accepts target > current", () => {
      expect(checkWeightCoherence("gain_weight", 70, 80)).toBeNull();
    });
  });

  describe("maintain", () => {
    it("accepts exact equality", () => {
      expect(checkWeightCoherence("maintain", 80, 80)).toBeNull();
    });
    it("accepts within +2 kg", () => {
      expect(checkWeightCoherence("maintain", 80, 82)).toBeNull();
    });
    it("accepts within -2 kg", () => {
      expect(checkWeightCoherence("maintain", 80, 78)).toBeNull();
    });
    it("rejects > 2 kg drift", () => {
      expect(checkWeightCoherence("maintain", 80, 83)).not.toBeNull();
      expect(checkWeightCoherence("maintain", 80, 77)).not.toBeNull();
    });
  });

  describe("build_muscle (N004: accepts any direction)", () => {
    it("accepts target > current", () => {
      expect(checkWeightCoherence("build_muscle", 70, 80)).toBeNull();
    });
    it("accepts target == current (recomposition)", () => {
      expect(checkWeightCoherence("build_muscle", 70, 70)).toBeNull();
    });
    it("accepts target < current", () => {
      expect(checkWeightCoherence("build_muscle", 80, 70)).toBeNull();
    });
  });
});
