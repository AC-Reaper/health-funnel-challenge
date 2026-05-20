import { describe, expect, it } from "vitest";

import { resolveLandingCta } from "@/lib/landing-cta";

describe("resolveLandingCta", () => {
  it("returns 'start' when there is no session", () => {
    expect(resolveLandingCta(null, false)).toBe("start");
    // hasAnswers is irrelevant without a session.
    expect(resolveLandingCta(null, true)).toBe("start");
  });

  it("returns 'start' for a draft session with no answers yet", () => {
    expect(resolveLandingCta({ status: "draft" }, false)).toBe("start");
  });

  it("returns 'continue' for a draft session with progress", () => {
    expect(resolveLandingCta({ status: "draft" }, true)).toBe("continue");
  });

  it("returns 'results' for a submitted session (regardless of answers)", () => {
    expect(resolveLandingCta({ status: "submitted" }, false)).toBe("results");
    expect(resolveLandingCta({ status: "submitted" }, true)).toBe("results");
  });
});
