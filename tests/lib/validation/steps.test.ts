import { describe, expect, it } from "vitest";

import { STEP_SCHEMAS, isStepKey } from "@/lib/validation/steps";

describe("isStepKey", () => {
  it.each(["gender", "main_goal", "age", "height", "weight", "activity"])(
    'accepts "%s"',
    (key) => {
      expect(isStepKey(key)).toBe(true);
    },
  );

  it.each(["", "Gender", "submit", "weight_kg", "unknown"])(
    'rejects "%s"',
    (key) => {
      expect(isStepKey(key)).toBe(false);
    },
  );

  // review-002 B002: inherited Object.prototype keys must not pass
  // the guard. Using `in` (the previous implementation) accepts them
  // and turns hostile input into a 500 inside the route.
  it.each([
    "toString",
    "constructor",
    "__proto__",
    "hasOwnProperty",
    "valueOf",
    "isPrototypeOf",
    "propertyIsEnumerable",
  ])('rejects inherited Object.prototype key "%s"', (key) => {
    expect(isStepKey(key)).toBe(false);
  });
});

describe("STEP_SCHEMAS.gender", () => {
  it("accepts female and male", () => {
    expect(STEP_SCHEMAS.gender.safeParse({ gender: "female" }).success).toBe(true);
    expect(STEP_SCHEMAS.gender.safeParse({ gender: "male" }).success).toBe(true);
  });

  it("rejects unknown enum + extra keys", () => {
    expect(STEP_SCHEMAS.gender.safeParse({ gender: "other" }).success).toBe(false);
    expect(STEP_SCHEMAS.gender.safeParse({ gender: "female", extra: 1 }).success).toBe(false);
    expect(STEP_SCHEMAS.gender.safeParse({}).success).toBe(false);
  });
});

describe("STEP_SCHEMAS.main_goal", () => {
  it.each(["lose_weight", "maintain", "gain_weight", "build_muscle"])(
    'accepts "%s"',
    (mainGoal) => {
      expect(STEP_SCHEMAS.main_goal.safeParse({ mainGoal }).success).toBe(true);
    },
  );

  it("rejects unknown enum", () => {
    expect(STEP_SCHEMAS.main_goal.safeParse({ mainGoal: "bulk" }).success).toBe(false);
  });
});

describe("STEP_SCHEMAS.age (int 13..100)", () => {
  it.each([13, 14, 50, 99, 100])("accepts %s", (n) => {
    expect(STEP_SCHEMAS.age.safeParse({ ageYears: n }).success).toBe(true);
  });

  it.each([12, 101, -1, 0])("rejects %s", (n) => {
    expect(STEP_SCHEMAS.age.safeParse({ ageYears: n }).success).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(STEP_SCHEMAS.age.safeParse({ ageYears: 29.5 }).success).toBe(false);
    expect(STEP_SCHEMAS.age.safeParse({ ageYears: "29" }).success).toBe(false);
    expect(STEP_SCHEMAS.age.safeParse({}).success).toBe(false);
  });
});

describe("STEP_SCHEMAS.height (int 120..230)", () => {
  it.each([120, 168, 230])("accepts %s", (n) => {
    expect(STEP_SCHEMAS.height.safeParse({ heightCm: n }).success).toBe(true);
  });

  it.each([119, 231, 0])("rejects %s", (n) => {
    expect(STEP_SCHEMAS.height.safeParse({ heightCm: n }).success).toBe(false);
  });

  it("rejects non-integers", () => {
    expect(STEP_SCHEMAS.height.safeParse({ heightCm: 168.5 }).success).toBe(false);
  });
});

describe("STEP_SCHEMAS.weight (numbers 30..250)", () => {
  it("accepts boundaries", () => {
    expect(
      STEP_SCHEMAS.weight.safeParse({ weightKg: 30, targetWeightKg: 30 }).success,
    ).toBe(true);
    expect(
      STEP_SCHEMAS.weight.safeParse({ weightKg: 250, targetWeightKg: 250 }).success,
    ).toBe(true);
    expect(
      STEP_SCHEMAS.weight.safeParse({ weightKg: 80.5, targetWeightKg: 70.5 }).success,
    ).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(
      STEP_SCHEMAS.weight.safeParse({ weightKg: 29.99, targetWeightKg: 70 }).success,
    ).toBe(false);
    expect(
      STEP_SCHEMAS.weight.safeParse({ weightKg: 80, targetWeightKg: 250.01 }).success,
    ).toBe(false);
  });

  it("requires both fields", () => {
    expect(STEP_SCHEMAS.weight.safeParse({ weightKg: 80 }).success).toBe(false);
    expect(STEP_SCHEMAS.weight.safeParse({ targetWeightKg: 70 }).success).toBe(false);
  });

  it("rejects extra keys via .strict()", () => {
    expect(
      STEP_SCHEMAS.weight.safeParse({
        weightKg: 80,
        targetWeightKg: 70,
        bonus: 1,
      }).success,
    ).toBe(false);
  });
});

describe("STEP_SCHEMAS.activity", () => {
  it.each(["sedentary", "light", "moderate", "active", "very_active"])(
    'accepts "%s"',
    (activityLevel) => {
      expect(STEP_SCHEMAS.activity.safeParse({ activityLevel }).success).toBe(true);
    },
  );

  it("rejects unknown enum", () => {
    expect(STEP_SCHEMAS.activity.safeParse({ activityLevel: "lazy" }).success).toBe(false);
  });
});
