import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub next/headers so the module under test can be imported in a
// node test environment. The forwarded-header fallback path uses
// `headers()`; pinned APP_ORIGIN bypasses it.
vi.mock("next/headers", () => ({
  headers: async () => ({
    get(name: string) {
      const map: Record<string, string> = {
        "x-forwarded-host": "fwd.example.com",
        "x-forwarded-proto": "https",
      };
      return map[name] ?? null;
    },
  }),
  cookies: async () => ({ getAll: () => [] }),
}));

import {
  _resetAppOriginCacheForTests,
  internalUrl,
} from "@/lib/internal-fetch";

describe("internalUrl()", () => {
  const ORIGINAL = process.env.APP_ORIGIN;

  beforeEach(() => {
    _resetAppOriginCacheForTests();
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = ORIGINAL;
    _resetAppOriginCacheForTests();
  });

  it("uses APP_ORIGIN verbatim when set, ignoring forwarded headers", async () => {
    process.env.APP_ORIGIN = "https://app.example.com";
    const url = await internalUrl("/api/v1/results/me");
    expect(url).toBe("https://app.example.com/api/v1/results/me");
  });

  it("strips any path/query from APP_ORIGIN (URL.origin)", async () => {
    process.env.APP_ORIGIN = "https://app.example.com/whatever?ignore=me";
    const url = await internalUrl("/api/v1/healthz");
    expect(url).toBe("https://app.example.com/api/v1/healthz");
  });

  it("falls back to forwarded-host / forwarded-proto when APP_ORIGIN is unset", async () => {
    delete process.env.APP_ORIGIN;
    const url = await internalUrl("/api/v1/sessions/me");
    expect(url).toBe("https://fwd.example.com/api/v1/sessions/me");
  });

  it("rejects a malformed APP_ORIGIN on first use (fail-fast)", async () => {
    process.env.APP_ORIGIN = "not a url";
    await expect(internalUrl("/api/v1/healthz")).rejects.toThrow();
  });

  it("rejects a non-http(s) APP_ORIGIN scheme (fail-fast)", async () => {
    process.env.APP_ORIGIN = "javascript:alert(1)";
    await expect(internalUrl("/api/v1/healthz")).rejects.toThrow(
      /http\(s\) origin/,
    );
  });
});
