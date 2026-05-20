import { describe, expect, it } from "vitest";

import {
  RATE_LIMITS,
  type RateLimitStore,
  clientIp,
  identityHash,
  rateLimitKey,
  resolveWindow,
  retryAfterSeconds,
  runRateLimit,
} from "@/lib/api/rate-limit";

const REQUEST_ID = "req_test_00000000-0000-0000-0000-000000000000";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/test", {
    method: "POST",
    headers,
  });
}

/** In-memory fixed-window store mirroring the Prisma upsert semantics. */
class MemStore implements RateLimitStore {
  readonly counts = new Map<string, number>();
  throwOnIncrement = false;
  async increment(key: string): Promise<number> {
    if (this.throwOnIncrement) throw new Error("store down");
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
}

// ---------- pure helpers ----------

describe("clientIp", () => {
  it("takes the left-most x-forwarded-for entry", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });
  it("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(req())).toBe("unknown");
  });
});

describe("identityHash", () => {
  it("is stable for the same IP+sid+UA and differs when any component changes", () => {
    const base = req({ "x-forwarded-for": "1.1.1.1", "user-agent": "ua-a" });
    const h1 = identityHash(base, "sid-1");
    expect(identityHash(base, "sid-1")).toBe(h1);
    // different sid
    expect(identityHash(base, "sid-2")).not.toBe(h1);
    // different IP
    expect(
      identityHash(req({ "x-forwarded-for": "2.2.2.2", "user-agent": "ua-a" }), "sid-1"),
    ).not.toBe(h1);
    // different UA
    expect(
      identityHash(req({ "x-forwarded-for": "1.1.1.1", "user-agent": "ua-b" }), "sid-1"),
    ).not.toBe(h1);
  });

  it("does not embed the raw IP or UA in the hash output", () => {
    const h = identityHash(
      req({ "x-forwarded-for": "1.2.3.4", "user-agent": "secret-agent" }),
      "sid-1",
    );
    expect(h).not.toContain("1.2.3.4");
    expect(h).not.toContain("secret-agent");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("resolveWindow / rateLimitKey / retryAfterSeconds", () => {
  it("buckets a timestamp into a fixed window", () => {
    const w = resolveWindow(125_000, 60); // 125s → window epoch 2 (120s..180s)
    expect(w.windowEpoch).toBe(2);
    expect(w.windowStart.getTime()).toBe(120_000);
    expect(w.expiresAt.getTime()).toBe(180_000);
  });
  it("rolls to a new epoch at the boundary", () => {
    expect(resolveWindow(179_999, 60).windowEpoch).toBe(2);
    expect(resolveWindow(180_000, 60).windowEpoch).toBe(3);
  });
  it("composes a route:identity:epoch key", () => {
    expect(rateLimitKey("pay", "abc", 7)).toBe("pay:abc:7");
  });
  it("rounds Retry-After up to whole seconds, min 1", () => {
    expect(retryAfterSeconds(100_000, 102_500)).toBe(3);
    expect(retryAfterSeconds(100_000, 100_000)).toBe(1);
  });
});

// ---------- orchestration ----------

describe("runRateLimit", () => {
  it("allows requests up to the limit, then 429s the next one", async () => {
    const store = new MemStore();
    const rule = RATE_LIMITS.pay;
    const r = req({ "x-forwarded-for": "1.1.1.1", "user-agent": "ua" });

    for (let i = 0; i < rule.limit; i++) {
      const out = await runRateLimit(store, r, "pay", REQUEST_ID, "sid", 1_000);
      expect(out.ok).toBe(true);
    }
    const over = await runRateLimit(store, r, "pay", REQUEST_ID, "sid", 1_000);
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.res.status).toBe(429);
    expect(over.res.headers.get("Retry-After")).toBeTruthy();
    const body = await over.res.json();
    expect(body.error.code).toBe("RATE_LIMITED");
  });

  it("fail-opens when the store throws (never breaks the loop)", async () => {
    const store = new MemStore();
    store.throwOnIncrement = true;
    const out = await runRateLimit(
      store,
      req({ "x-forwarded-for": "1.1.1.1" }),
      "sessions",
      REQUEST_ID,
      null,
      1_000,
    );
    expect(out.ok).toBe(true);
  });

  it("resets the count when the window rolls over", async () => {
    const store = new MemStore();
    const r = req({ "x-forwarded-for": "1.1.1.1", "user-agent": "ua" });
    const rule = RATE_LIMITS.submit;
    // Exhaust window A.
    for (let i = 0; i < rule.limit; i++) {
      await runRateLimit(store, r, "submit", REQUEST_ID, "sid", 1_000);
    }
    const blocked = await runRateLimit(store, r, "submit", REQUEST_ID, "sid", 1_000);
    expect(blocked.ok).toBe(false);
    // Next window (60s later) is a fresh bucket.
    const nextWindow = await runRateLimit(
      store,
      r,
      "submit",
      REQUEST_ID,
      "sid",
      1_000 + rule.windowSeconds * 1000,
    );
    expect(nextWindow.ok).toBe(true);
  });

  it("keeps separate buckets per identity (different sid)", async () => {
    const store = new MemStore();
    const r = req({ "x-forwarded-for": "1.1.1.1", "user-agent": "ua" });
    const rule = RATE_LIMITS.pay;
    for (let i = 0; i < rule.limit; i++) {
      await runRateLimit(store, r, "pay", REQUEST_ID, "sid-A", 1_000);
    }
    expect((await runRateLimit(store, r, "pay", REQUEST_ID, "sid-A", 1_000)).ok).toBe(
      false,
    );
    // A different session id is an independent bucket.
    expect((await runRateLimit(store, r, "pay", REQUEST_ID, "sid-B", 1_000)).ok).toBe(
      true,
    );
  });
});
