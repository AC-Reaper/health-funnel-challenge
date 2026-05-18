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
});
