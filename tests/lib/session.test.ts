import { describe, expect, it } from "vitest";

import { signCookie, verifyCookie } from "@/lib/session";

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
