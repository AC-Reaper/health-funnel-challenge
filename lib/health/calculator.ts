/**
 * Health calculator (T-301).
 *
 * Pure, deterministic, versioned. No I/O. The `result` row stored after
 * `/submit` is built from the output of `compute()`; the algorithmVersion
 * tag travels with it so future formula changes can be detected and
 * old results recomputed if required.
 *
 * Formulas (locked in ADR-013 + docs/02-architecture.md §4):
 *   BMI       = weight_kg / (height_m)^2
 *   BMR       = Mifflin-St Jeor
 *               10 * kg + 6.25 * cm - 5 * age + (male ? 5 : -161)
 *   TDEE      = BMR * activityFactor
 *   target    = TDEE - 500 (loss) / + 300 (gain) / 0 (maintain)
 *               + 250 (build_muscle, mild surplus)
 *               clamped to the per-gender floor:
 *                 female 1200 kcal/day
 *                 male   1500 kcal/day
 *   curve     = weekly delta of +/- 0.5 kg/week toward target
 *               (build_muscle: target<=current uses 0.5 kg/week loss;
 *                target>current uses 0.25 kg/week lean-mass gain;
 *                target==current emits a flat curve and a null target date)
 *   target date = projected from "now" using the weekly step
 *   short-circuit: if |target-current| / current > 0.30 the goal is
 *               unrealistic. predictedTargetDate = null and
 *               plan.note = "consult_professional".
 */

export const ALGORITHM_VERSION = "v1.0.0-mifflin";

const UNREALISTIC_DELTA_RATIO = 0.30;
const WEEKLY_LOSS_KG = 0.5;
const WEEKLY_GAIN_KG = 0.5;
const WEEKLY_BUILD_MUSCLE_KG = 0.25;
const MAX_CURVE_WEEKS = 52; // 1 year; longer plans are not meaningful here.

const CALORIE_FLOOR = { female: 1200, male: 1500 } as const;

const ACTIVITY_FACTOR = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

const HEADLINE_DELTA = {
  lose_weight: -500,
  gain_weight: 300,
  build_muscle: 250,
  maintain: 0,
} as const;

export type Gender = "female" | "male";
export type MainGoal = "lose_weight" | "maintain" | "gain_weight" | "build_muscle";
export type ActivityLevel = keyof typeof ACTIVITY_FACTOR;
export type BmiCategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obese_i"
  | "obese_ii"
  | "obese_iii";

export interface CalculatorInput {
  gender: Gender;
  mainGoal: MainGoal;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activityLevel: ActivityLevel;
  /** Optional override for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
}

export interface CurvePoint {
  week: number;
  weightKg: number;
}

export interface CalculatorOutput {
  bmi: number;
  bmiCategory: BmiCategory;
  dailyCaloriesKcal: number;
  predictedTargetDate: Date | null;
  curvePoints: CurvePoint[];
  plan: {
    summary: string;
    note: "consult_professional" | null;
  };
  algorithmVersion: typeof ALGORITHM_VERSION;
}

export function compute(input: CalculatorInput): CalculatorOutput {
  const bmi = computeBmi(input.weightKg, input.heightCm);
  const bmiCategory = bmiCategoryFromBmi(bmi);

  const deltaRatio =
    Math.abs(input.targetWeightKg - input.weightKg) / input.weightKg;
  const isUnrealistic = deltaRatio > UNREALISTIC_DELTA_RATIO;

  const dailyCaloriesKcal = computeDailyCalories(input);
  const { curvePoints, predictedTargetDate } = isUnrealistic
    ? { curvePoints: [{ week: 0, weightKg: round2(input.weightKg) }], predictedTargetDate: null }
    : computeCurveAndDate(input);

  const plan = buildPlan(input, isUnrealistic);

  return {
    bmi: round2(bmi),
    bmiCategory,
    dailyCaloriesKcal,
    predictedTargetDate,
    curvePoints,
    plan,
    algorithmVersion: ALGORITHM_VERSION,
  };
}

// ---------- internals ----------

export function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function bmiCategoryFromBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  if (bmi < 35) return "obese_i";
  if (bmi < 40) return "obese_ii";
  return "obese_iii";
}

export function computeBmr(input: Pick<CalculatorInput, "gender" | "ageYears" | "heightCm" | "weightKg">): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return input.gender === "male" ? base + 5 : base - 161;
}

export function computeTdee(input: CalculatorInput): number {
  return computeBmr(input) * ACTIVITY_FACTOR[input.activityLevel];
}

export function computeDailyCalories(input: CalculatorInput): number {
  const tdee = computeTdee(input);
  const adjusted = tdee + HEADLINE_DELTA[input.mainGoal];
  const floor = CALORIE_FLOOR[input.gender];
  return Math.max(floor, Math.round(adjusted));
}

function computeCurveAndDate(input: CalculatorInput): {
  curvePoints: CurvePoint[];
  predictedTargetDate: Date | null;
} {
  const now = input.now ?? new Date();
  const start = input.weightKg;
  const target = input.targetWeightKg;
  const totalDelta = target - start;

  if (Math.abs(totalDelta) < 1e-6) {
    // Maintenance / recomposition flat plan: 4 marker weeks at current weight,
    // null predicted target date because no progression is expected.
    const flat: CurvePoint[] = [0, 4, 8, 12].map((week) => ({
      week,
      weightKg: round2(start),
    }));
    return { curvePoints: flat, predictedTargetDate: null };
  }

  const weeklyMagnitude =
    input.mainGoal === "build_muscle" && totalDelta > 0
      ? WEEKLY_BUILD_MUSCLE_KG
      : totalDelta > 0
        ? WEEKLY_GAIN_KG
        : WEEKLY_LOSS_KG;

  const direction = Math.sign(totalDelta);
  const weeklyStep = direction * weeklyMagnitude;
  const fullWeeks = Math.ceil(Math.abs(totalDelta) / weeklyMagnitude);
  const weeks = Math.min(fullWeeks, MAX_CURVE_WEEKS);
  const isTruncated = fullWeeks > MAX_CURVE_WEEKS;

  const curvePoints: CurvePoint[] = [];
  for (let w = 0; w <= weeks; w++) {
    // Snap to the requested target ONLY at the natural endpoint of an
    // un-truncated plan. Truncated curves (review-006 I002) emit the
    // linearly-projected weight at week 52 instead, so the response does
    // not simultaneously claim "date unknown" and "target reached".
    const projected =
      !isTruncated && w === weeks ? target : start + weeklyStep * w;
    curvePoints.push({ week: w, weightKg: round2(projected) });
  }

  if (isTruncated) {
    // The path is too long to reach target within a year at the safe rate.
    // Emit the 1-year preview, but flag the date as unknown.
    return { curvePoints, predictedTargetDate: null };
  }

  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + weeks * 7);
  // Normalise to date-only (UTC) so the column-level @db.Date round-trips cleanly.
  const isoDate = new Date(
    Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate()),
  );

  return { curvePoints, predictedTargetDate: isoDate };
}

function buildPlan(
  input: CalculatorInput,
  isUnrealistic: boolean,
): CalculatorOutput["plan"] {
  if (isUnrealistic) {
    return {
      summary: `Goal ${input.targetWeightKg} kg is too far from current ${input.weightKg} kg for a safe plan.`,
      note: "consult_professional",
    };
  }
  switch (input.mainGoal) {
    case "lose_weight":
      return {
        summary: `Sustainable 0.5 kg/week deficit toward ${input.targetWeightKg} kg.`,
        note: null,
      };
    case "gain_weight":
      return {
        summary: `Steady 0.5 kg/week surplus toward ${input.targetWeightKg} kg.`,
        note: null,
      };
    case "build_muscle":
      return {
        summary:
          input.targetWeightKg > input.weightKg
            ? `Lean-mass plan: ~0.25 kg/week toward ${input.targetWeightKg} kg.`
            : `Recomposition plan at ~${input.weightKg} kg with strength focus.`,
        note: null,
      };
    case "maintain":
      return {
        summary: `Maintain around ${input.weightKg} kg with TDEE-aligned intake.`,
        note: null,
      };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
