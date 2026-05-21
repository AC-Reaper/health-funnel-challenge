import { afterEach, describe, expect, it, vi } from "vitest";

import {
  COOKIE_MAX_AGE_SECONDS,
  DEMO_SEED_USER_AGENT,
  isDemoSeedSession,
  signCookie,
  verifyCookie,
} from "@/lib/session";

const VALID_SID = "f8fd9992-7ea9-44d9-ac89-e04e14eaf314";

describe("signCookie / verifyCookie round-trip", () => {
  it("verifies a freshly signed cookie back to the original sid", () => {
    const cookie = signCookie(VALID_SID);
    expect(verifyCookie(cookie)).toBe(VALID_SID);
  });

  it("produces a base64url payload (no =/+/ characters)", () => {
    const cookie = signCookie(VALID_SID);
    expect(cookie).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("differs between distinct sids", () => {
    const a = signCookie(VALID_SID);
    const b = signCookie("00000000-0000-0000-0000-000000000001");
    expect(a).not.toBe(b);
  });
});

describe("verifyCookie failure modes", () => {
  it("rejects undefined / empty", () => {
    expect(verifyCookie(undefined)).toBeNull();
    expect(verifyCookie("")).toBeNull();
  });

  it("rejects garbage that is not valid base64url JSON", () => {
    expect(verifyCookie("not-a-cookie")).toBeNull();
  });

  it("rejects a base64url-encoded non-JSON payload", () => {
    const not_json = Buffer.from("not json", "utf8").toString("base64url");
    expect(verifyCookie(not_json)).toBeNull();
  });

  it("rejects payload missing required fields", () => {
    const partial = Buffer.from(JSON.stringify({ sid: VALID_SID }), "utf8").toString("base64url");
    expect(verifyCookie(partial)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const cookie = signCookie(VALID_SID);
    const decoded = JSON.parse(Buffer.from(cookie, "base64url").toString("utf8"));
    decoded.sig = decoded.sig.replace(/.$/, (c: string) => (c === "0" ? "1" : "0"));
    const tampered = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(verifyCookie(tampered)).toBeNull();
  });

  it("rejects a wrong-length signature", () => {
    const decoded = { sid: VALID_SID, sig: "deadbeef" };
    const bad = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(verifyCookie(bad)).toBeNull();
  });

  it("rejects a signature valid for a different sid", () => {
    const cookieForA = signCookie("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    const decoded = JSON.parse(Buffer.from(cookieForA, "base64url").toString("utf8"));
    // Swap sid only; signature stays the one we computed for "aaaa..."
    decoded.sid = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const swapped = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
    expect(verifyCookie(swapped)).toBeNull();
  });
});

// ---------- T-501: server-side TTL (iat + 30d expiry, ADR-014) ----------

function decodeCookie(raw: string): { sid: string; iat: number; sig: string } {
  return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
}

function encodeCookie(payload: { sid: string; iat: number; sig: string }): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("verifyCookie TTL (T-501 expired-cookie hardening)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a cookie issued 1 second ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const cookie = signCookie(VALID_SID);

    vi.setSystemTime(new Date("2026-06-01T00:00:01.000Z"));
    expect(verifyCookie(cookie)).toBe(VALID_SID);
  });

  it("rejects a cookie one second past COOKIE_MAX_AGE_SECONDS", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const cookie = signCookie(VALID_SID);

    // Advance time by exactly TTL + 1s — should be expired.
    vi.setSystemTime(new Date((Date.now() + (COOKIE_MAX_AGE_SECONDS + 1) * 1000)));
    expect(verifyCookie(cookie)).toBeNull();
  });

  it("rejects a cookie whose `iat` is in the far future (forged)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const cookie = signCookie(VALID_SID);
    const decoded = decodeCookie(cookie);
    // Push iat 1 hour into the future; this requires regenerating the HMAC
    // for the test to isolate the future-iat check from the sig-mismatch
    // check — but we can't because env.SESSION_COOKIE_SECRET isn't exported.
    // Instead we simply move system time backwards so the existing iat lands
    // in the future relative to "now".
    vi.setSystemTime(new Date("2026-05-31T22:00:00.000Z"));
    expect(decoded.iat).toBeGreaterThan(Math.floor(Date.now() / 1000) + 60);
    expect(verifyCookie(cookie)).toBeNull();
  });

  it("rejects a cookie missing `iat`", () => {
    const cookie = signCookie(VALID_SID);
    const decoded = decodeCookie(cookie);
    const stripped = { sid: decoded.sid, sig: decoded.sig } as unknown as {
      sid: string;
      iat: number;
      sig: string;
    };
    expect(verifyCookie(encodeCookie(stripped))).toBeNull();
  });

  it("rejects a cookie with non-integer `iat`", () => {
    const cookie = signCookie(VALID_SID);
    const decoded = decodeCookie(cookie);
    decoded.iat = decoded.iat + 0.5;
    expect(verifyCookie(encodeCookie(decoded))).toBeNull();
  });

  it("rejects a cookie whose `iat` was tampered after signing (HMAC mismatch)", () => {
    const cookie = signCookie(VALID_SID);
    const decoded = decodeCookie(cookie);
    decoded.iat = decoded.iat - 10; // signed value differs; sig no longer valid
    expect(verifyCookie(encodeCookie(decoded))).toBeNull();
  });
});

describe("isDemoSeedSession (ADR-019 by-session demo scoping)", () => {
  it("accepts the exact demo seed marker User-Agent", () => {
    expect(isDemoSeedSession(DEMO_SEED_USER_AGENT)).toBe(true);
  });

  it("rejects a null User-Agent (real cookie-jar cURL with no UA)", () => {
    expect(isDemoSeedSession(null)).toBe(false);
  });

  it("rejects a normal browser User-Agent", () => {
    expect(
      isDemoSeedSession(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      ),
    ).toBe(false);
  });

  it("rejects a near-miss marker (no partial / prefix match)", () => {
    expect(isDemoSeedSession("health-funnel-demo-seed/1.0 extra")).toBe(false);
    expect(isDemoSeedSession("health-funnel-demo-seed")).toBe(false);
    expect(isDemoSeedSession("")).toBe(false);
  });
});
