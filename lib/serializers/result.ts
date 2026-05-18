import "server-only";

import type { Result } from "@prisma/client";

import type { BmiCategory, CurvePoint } from "../health/calculator";

/**
 * Paywall constants. Lives here because both the teaser serializer and
 * the /pay handler read them. Money is integer cents + ISO-4217 string.
 */
export const PRICE_CENTS = 999;
export const CURRENCY = "USD";
export const CTA_HREF = "/pay";

/**
 * Teaser DTO — what an unpaid session sees. Designed so the type CANNOT
 * carry paid-only fields: no shared base, no optional `dailyCaloriesKcal`
 * or `curvePoints`. If a future change adds a paid field to the result
 * row, the teaser serializer cannot accidentally include it because the
 * field name is not in this interface.
 */
export interface TeaserResultDTO {
  kind: "teaser";
  result: {
    bmi: number;
    bmiCategory: BmiCategory;
    headline: string;
  };
  paywall: {
    priceCents: number;
    currency: string;
    ctaHref: string;
  };
}

export interface FullResultDTO {
  kind: "full";
  result: {
    bmi: number;
    bmiCategory: BmiCategory;
    dailyCaloriesKcal: number;
    predictedTargetDate: string | null;
    curvePoints: CurvePoint[];
    plan: { summary: string; note: "consult_professional" | null };
    algorithmVersion: string;
  };
}

const HEADLINE_BY_CATEGORY: Record<BmiCategory, string> = {
  underweight:
    "Your starting BMI is below the healthy range — unlock your full plan.",
  normal:
    "Your starting point looks healthy — unlock your full plan.",
  overweight:
    "There's room to optimise — unlock your full plan.",
  obese_i:
    "We have a sustainable plan ready — unlock the full version.",
  obese_ii:
    "We have a careful, paced plan ready — unlock the full version.",
  obese_iii:
    "We have a careful, paced plan ready — unlock the full version.",
};

export function serializeTeaser(result: Result): TeaserResultDTO {
  const bmiCategory = result.bmiCategory as BmiCategory;
  return {
    kind: "teaser",
    result: {
      bmi: Number(result.bmi),
      bmiCategory,
      headline: HEADLINE_BY_CATEGORY[bmiCategory],
    },
    paywall: {
      priceCents: PRICE_CENTS,
      currency: CURRENCY,
      ctaHref: CTA_HREF,
    },
  };
}

export function serializeFull(result: Result): FullResultDTO {
  return {
    kind: "full",
    result: {
      bmi: Number(result.bmi),
      bmiCategory: result.bmiCategory as BmiCategory,
      dailyCaloriesKcal: result.dailyCaloriesKcal,
      predictedTargetDate: result.predictedTargetDate
        ? toIsoDateString(result.predictedTargetDate)
        : null,
      curvePoints: result.curvePointsJson as unknown as CurvePoint[],
      plan: result.planJson as unknown as FullResultDTO["result"]["plan"],
      algorithmVersion: result.algorithmVersion,
    },
  };
}

function toIsoDateString(d: Date): string {
  // YYYY-MM-DD; the column is @db.Date so this is the natural wire format.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
