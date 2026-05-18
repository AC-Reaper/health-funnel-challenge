import { describe, expect, it } from "vitest";

import { FULL_ASSESSMENT_SCHEMA } from "@/lib/validation/assessment";

const valid = {
  gender: "female" as const,
  mainGoal: "lose_weight" as const,
  ageYears: 29,
  heightCm: 168,
  weightKg: 80,
  targetWeightKg: 70,
  activityLevel: "moderate" as const,
};

describe("FULL_ASSESSMENT_SCHEMA", () => {
  it("accepts a fully populated valid assessment", () => {
    expect(FULL_ASSESSMENT_SCHEMA.safeParse(valid).success).toBe(true);
  });

  it.each([
    "gender",
    "mainGoal",
    "ageYears",
    "heightCm",
    "weightKg",
    "targetWeightKg",
    "activityLevel",
  ] as const)('rejects missing "%s"', (field) => {
    const broken: Record<string, unknown> = { ...valid };
    delete broken[field];
    expect(FULL_ASSESSMENT_SCHEMA.safeParse(broken).success).toBe(false);
  });

  it("rejects out-of-range boundary values inherited from the per-step schemas", () => {
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, ageYears: 12 }).success).toBe(false);
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, ageYears: 101 }).success).toBe(false);
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, heightCm: 119 }).success).toBe(false);
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, weightKg: 29.99 }).success).toBe(false);
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, targetWeightKg: 250.01 }).success).toBe(false);
  });

  it("rejects unknown enum values", () => {
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, gender: "other" }).success).toBe(false);
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, mainGoal: "bulk" }).success).toBe(false);
    expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, activityLevel: "lazy" }).success).toBe(false);
  });

  // review-006 I001 — superRefine enforces weight × main_goal coherence
  // at /submit so a row inserted via any non-step path cannot reach
  // compute() with an incoherent pair.
  describe("weight × main_goal coherence (review-006 I001)", () => {
    it("rejects lose_weight with target >= current", () => {
      const out = FULL_ASSESSMENT_SCHEMA.safeParse({
        ...valid,
        mainGoal: "lose_weight",
        weightKg: 70,
        targetWeightKg: 80,
      });
      expect(out.success).toBe(false);
      if (out.success) return;
      const paths = out.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("mainGoal");
      expect(paths).toContain("weightKg");
      expect(paths).toContain("targetWeightKg");
    });

    it("rejects gain_weight with target <= current", () => {
      const out = FULL_ASSESSMENT_SCHEMA.safeParse({
        ...valid,
        mainGoal: "gain_weight",
        weightKg: 80,
        targetWeightKg: 70,
      });
      expect(out.success).toBe(false);
    });

    it("rejects maintain when drift > 2 kg", () => {
      expect(
        FULL_ASSESSMENT_SCHEMA.safeParse({
          ...valid,
          mainGoal: "maintain",
          weightKg: 80,
          targetWeightKg: 70,
        }).success,
      ).toBe(false);
    });

    it("accepts build_muscle in any direction (review-002 N004 default)", () => {
      for (const target of [60, 70, 80]) {
        expect(
          FULL_ASSESSMENT_SCHEMA.safeParse({
            ...valid,
            mainGoal: "build_muscle",
            weightKg: 70,
            targetWeightKg: target,
          }).success,
        ).toBe(true);
      }
    });

    it("accepts coherent pairs for every other goal", () => {
      const cases = [
        { mainGoal: "lose_weight" as const, weightKg: 80, targetWeightKg: 70 },
        { mainGoal: "gain_weight" as const, weightKg: 60, targetWeightKg: 70 },
        { mainGoal: "maintain" as const, weightKg: 70, targetWeightKg: 71 },
      ];
      for (const c of cases) {
        expect(FULL_ASSESSMENT_SCHEMA.safeParse({ ...valid, ...c }).success).toBe(true);
      }
    });
  });
});
