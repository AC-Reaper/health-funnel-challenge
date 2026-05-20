import { describe, expect, it } from "vitest";

import { USER_AGENT_MAX_LENGTH, truncateUserAgent } from "@/lib/session";

describe("truncateUserAgent", () => {
  it("returns null for nullish input", () => {
    expect(truncateUserAgent(null)).toBeNull();
    expect(truncateUserAgent(undefined)).toBeNull();
    expect(truncateUserAgent("")).toBeNull();
  });

  it("passes short UAs through unchanged", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit";
    expect(truncateUserAgent(ua)).toBe(ua);
  });

  it("truncates to USER_AGENT_MAX_LENGTH chars", () => {
    const long = "A".repeat(USER_AGENT_MAX_LENGTH + 100);
    const out = truncateUserAgent(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(USER_AGENT_MAX_LENGTH);
  });
});
