import { describe, expect, it } from "vitest";

import {
  CTA_HREF,
  CURRENCY,
  PRICE_CENTS,
  serializeFull,
  serializeTeaser,
} from "@/lib/serializers/result";

import type { Result } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function fakeResult(overrides: Partial<Result> = {}): Result {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    sessionId: "00000000-0000-0000-0000-000000000002",
    bmi: new Decimal("22.40") as unknown as Result["bmi"],
    bmiCategory: "normal",
    dailyCaloriesKcal: 1850,
    predictedTargetDate: new Date(Date.UTC(2026, 7, 12)),
    curvePointsJson: [
      { week: 0, weightKg: 68 },
      { week: 12, weightKg: 62 },
    ] as unknown as Result["curvePointsJson"],
    planJson: {
      summary: "Sustainable 0.5kg/week deficit.",
      note: null,
    } as unknown as Result["planJson"],
    algorithmVersion: "v1.0.0-mifflin",
    computedAt: new Date("2026-05-18T09:35:00.000Z"),
    ...overrides,
  };
}

// ---------- serializeTeaser ----------

describe("serializeTeaser", () => {
  it("returns the documented teaser shape", () => {
    const dto = serializeTeaser(fakeResult());
    expect(dto.kind).toBe("teaser");
    expect(dto.result).toEqual({
      bmi: 22.4,
      bmiCategory: "normal",
      headline: expect.stringContaining("healthy"),
    });
    expect(dto.paywall).toEqual({
      priceCents: PRICE_CENTS,
      currency: CURRENCY,
      ctaHref: CTA_HREF,
    });
  });

  it("varies the headline by bmiCategory", () => {
    const normal = serializeTeaser(fakeResult({ bmiCategory: "normal" }));
    const obeseIii = serializeTeaser(fakeResult({ bmiCategory: "obese_iii" }));
    expect(normal.result.headline).not.toBe(obeseIii.result.headline);
  });

  it("LEAK INVARIANT: teaser JSON does NOT contain any paid-only field name", () => {
    const dto = serializeTeaser(fakeResult());
    const json = JSON.stringify(dto);
    for (const banned of [
      "dailyCaloriesKcal",
      "predictedTargetDate",
      "curvePoints",
      '"plan"',
      "algorithmVersion",
    ]) {
      expect(json).not.toContain(banned);
    }
  });

  it("teaser top-level result keys are a strict subset of the documented teaser keys", () => {
    const dto = serializeTeaser(fakeResult());
    const allowed = new Set(["bmi", "bmiCategory", "headline"]);
    for (const key of Object.keys(dto.result)) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});

// ---------- serializeFull ----------

describe("serializeFull", () => {
  it("returns the documented full shape", () => {
    const dto = serializeFull(fakeResult());
    expect(dto.kind).toBe("full");
    expect(dto.result.bmi).toBe(22.4);
    expect(dto.result.bmiCategory).toBe("normal");
    expect(dto.result.dailyCaloriesKcal).toBe(1850);
    expect(dto.result.predictedTargetDate).toBe("2026-08-12");
    expect(dto.result.curvePoints).toEqual([
      { week: 0, weightKg: 68 },
      { week: 12, weightKg: 62 },
    ]);
    expect(dto.result.plan).toEqual({
      summary: "Sustainable 0.5kg/week deficit.",
      note: null,
    });
    expect(dto.result.algorithmVersion).toBe("v1.0.0-mifflin");
  });

  it("emits predictedTargetDate as null when the result row has null", () => {
    const dto = serializeFull(fakeResult({ predictedTargetDate: null }));
    expect(dto.result.predictedTargetDate).toBeNull();
  });

  it("formats predictedTargetDate as YYYY-MM-DD (UTC)", () => {
    const dto = serializeFull(
      fakeResult({ predictedTargetDate: new Date(Date.UTC(2026, 0, 3)) }),
    );
    expect(dto.result.predictedTargetDate).toBe("2026-01-03");
  });
});
