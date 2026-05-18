import { describe, expect, it } from "vitest";

import {
  ALGORITHM_VERSION,
  bmiCategoryFromBmi,
  compute,
  computeBmi,
  computeBmr,
  computeDailyCalories,
  computeTdee,
  type CalculatorInput,
} from "@/lib/health/calculator";

const FIXED_NOW = new Date("2026-05-18T00:00:00.000Z");

function inputBase(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    gender: "female",
    mainGoal: "lose_weight",
    ageYears: 29,
    heightCm: 168,
    weightKg: 80,
    targetWeightKg: 70,
    activityLevel: "moderate",
    now: FIXED_NOW,
    ...overrides,
  };
}

// ---------- BMI banding ----------

describe("computeBmi + bmiCategoryFromBmi", () => {
  it("computes BMI using weight_kg / height_m^2", () => {
    expect(computeBmi(80, 168)).toBeCloseTo(28.34, 1);
    expect(computeBmi(60, 170)).toBeCloseTo(20.76, 1);
  });

  it.each([
    [17.9, "underweight"],
    [18.5, "normal"],
    [24.9, "normal"],
    [25.0, "overweight"],
    [29.9, "overweight"],
    [30.0, "obese_i"],
    [34.9, "obese_i"],
    [35.0, "obese_ii"],
    [39.9, "obese_ii"],
    [40.0, "obese_iii"],
    [55.0, "obese_iii"],
  ] as const)("bmi %s → %s", (bmi, expected) => {
    expect(bmiCategoryFromBmi(bmi)).toBe(expected);
  });

  it("handles the boundary BMI that motivated decimal(5,2) (review-003 B001)", () => {
    // heightCm=120, weightKg=250 -> ~173.61
    const bmi = computeBmi(250, 120);
    expect(bmi).toBeGreaterThan(99.99);
    expect(bmiCategoryFromBmi(bmi)).toBe("obese_iii");
    expect(round2(bmi)).toBe(173.61);
  });
});

// ---------- BMR (Mifflin-St Jeor) ----------

describe("computeBmr", () => {
  // 10*80 + 6.25*168 - 5*29 - 161 = 800 + 1050 - 145 - 161 = 1544
  it("female", () => {
    expect(
      computeBmr({ gender: "female", ageYears: 29, heightCm: 168, weightKg: 80 }),
    ).toBeCloseTo(1544, 0);
  });

  // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  it("male", () => {
    expect(
      computeBmr({ gender: "male", ageYears: 30, heightCm: 180, weightKg: 80 }),
    ).toBeCloseTo(1780, 0);
  });
});

// ---------- TDEE / daily calories ----------

describe("computeTdee + computeDailyCalories", () => {
  it("applies the activity factor (moderate = 1.55)", () => {
    const tdee = computeTdee(inputBase());
    expect(tdee).toBeCloseTo(1544 * 1.55, 0);
  });

  it("loses 500 kcal vs TDEE on lose_weight", () => {
    const cal = computeDailyCalories(inputBase({ mainGoal: "lose_weight" }));
    expect(cal).toBe(Math.round(1544 * 1.55) - 500);
  });

  it("gains 300 kcal vs TDEE on gain_weight", () => {
    const cal = computeDailyCalories(inputBase({ mainGoal: "gain_weight" }));
    expect(cal).toBe(Math.round(1544 * 1.55) + 300);
  });

  it("adds 250 kcal vs TDEE on build_muscle", () => {
    const cal = computeDailyCalories(inputBase({ mainGoal: "build_muscle" }));
    expect(cal).toBe(Math.round(1544 * 1.55) + 250);
  });

  it("matches TDEE exactly on maintain", () => {
    const cal = computeDailyCalories(inputBase({ mainGoal: "maintain" }));
    expect(cal).toBe(Math.round(1544 * 1.55));
  });

  it("never drops below 1200 kcal for female", () => {
    const cal = computeDailyCalories(
      inputBase({
        gender: "female",
        ageYears: 80,
        heightCm: 140,
        weightKg: 45,
        activityLevel: "sedentary",
        mainGoal: "lose_weight",
      }),
    );
    expect(cal).toBeGreaterThanOrEqual(1200);
  });

  it("never drops below 1500 kcal for male", () => {
    const cal = computeDailyCalories(
      inputBase({
        gender: "male",
        ageYears: 80,
        heightCm: 150,
        weightKg: 50,
        activityLevel: "sedentary",
        mainGoal: "lose_weight",
      }),
    );
    expect(cal).toBeGreaterThanOrEqual(1500);
  });
});

// ---------- compute() integration ----------

describe("compute", () => {
  it("returns the documented shape for a realistic lose_weight goal", () => {
    const out = compute(inputBase());
    expect(out.algorithmVersion).toBe("v1.0.0-mifflin");
    expect(out.algorithmVersion).toBe(ALGORITHM_VERSION);
    expect(typeof out.bmi).toBe("number");
    expect(out.bmiCategory).toBe("overweight");
    expect(out.dailyCaloriesKcal).toBeGreaterThan(1200);
    expect(out.predictedTargetDate).toBeInstanceOf(Date);
    expect(out.curvePoints.length).toBeGreaterThan(0);
    expect(out.curvePoints[0]).toEqual({ week: 0, weightKg: 80 });
    expect(out.curvePoints.at(-1)?.weightKg).toBe(70);
    expect(out.plan.note).toBeNull();
  });

  it("walks 0.5 kg/week loss to the target", () => {
    const out = compute(inputBase({ weightKg: 80, targetWeightKg: 75 }));
    // 5 kg / 0.5 = 10 weeks
    expect(out.curvePoints.at(-1)?.week).toBe(10);
    expect(out.predictedTargetDate).toEqual(
      new Date(Date.UTC(2026, 6, 27)), // 10 weeks after 2026-05-18 → 2026-07-27
    );
  });

  it("walks 0.5 kg/week gain on gain_weight", () => {
    const out = compute(
      inputBase({ mainGoal: "gain_weight", weightKg: 60, targetWeightKg: 64 }),
    );
    expect(out.curvePoints.at(-1)?.week).toBe(8);
    expect(out.curvePoints.at(-1)?.weightKg).toBe(64);
  });

  it("walks 0.25 kg/week on build_muscle when targeting weight gain", () => {
    const out = compute(
      inputBase({ mainGoal: "build_muscle", weightKg: 70, targetWeightKg: 73 }),
    );
    // 3 kg / 0.25 = 12 weeks
    expect(out.curvePoints.at(-1)?.week).toBe(12);
  });

  it("emits a flat 4-marker curve and null target date on maintain (target==current)", () => {
    const out = compute(
      inputBase({ mainGoal: "maintain", weightKg: 70, targetWeightKg: 70 }),
    );
    expect(out.predictedTargetDate).toBeNull();
    expect(out.curvePoints.map((p) => p.week)).toEqual([0, 4, 8, 12]);
    expect(out.curvePoints.every((p) => p.weightKg === 70)).toBe(true);
    expect(out.plan.note).toBeNull();
  });

  it("returns null target date + consult_professional when |delta|/current > 0.30", () => {
    const out = compute(inputBase({ weightKg: 100, targetWeightKg: 60 }));
    expect(out.predictedTargetDate).toBeNull();
    expect(out.plan.note).toBe("consult_professional");
    expect(out.curvePoints).toEqual([{ week: 0, weightKg: 100 }]);
  });

  it("is pure (same input → deep-equal output)", () => {
    const a = compute(inputBase());
    const b = compute(inputBase());
    expect(a).toEqual(b);
  });

  it("normalises predictedTargetDate to UTC midnight", () => {
    const out = compute(inputBase({ weightKg: 80, targetWeightKg: 75 }));
    const d = out.predictedTargetDate!;
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it("rounds BMI to 2 decimals", () => {
    const out = compute(inputBase());
    expect(out.bmi).toBe(round2(out.bmi));
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
