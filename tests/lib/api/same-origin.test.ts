import { describe, expect, it } from "vitest";

import { checkSameOrigin } from "@/lib/api/same-origin";

function makeReq(headers: Record<string, string>): Request {
  return new Request("https://app.example.com/api/v1/sessions", {
    method: "POST",
    headers,
  });
}

describe("checkSameOrigin", () => {
  it("passes when no Origin header is present (cURL / server-internal fetch)", () => {
    const req = makeReq({ host: "app.example.com" });
    const out = checkSameOrigin(req, "req_test_1");
    expect(out.ok).toBe(true);
  });

  it("passes when Origin host matches Host", () => {
    const req = makeReq({
      host: "app.example.com",
      origin: "https://app.example.com",
    });
    const out = checkSameOrigin(req, "req_test_2");
    expect(out.ok).toBe(true);
  });

  it("rejects when Origin host does not match Host", async () => {
    const req = makeReq({
      host: "app.example.com",
      origin: "https://evil.example",
    });
    const out = checkSameOrigin(req, "req_test_3");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.res.status).toBe(403);
    const body = (await out.res.json()) as {
      error: { code: string; requestId: string };
    };
    expect(body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(body.error.requestId).toBe("req_test_3");
  });

  it("rejects Origin === 'null' (sandboxed iframe / data: URL)", async () => {
    const req = makeReq({
      host: "app.example.com",
      origin: "null",
    });
    const out = checkSameOrigin(req, "req_test_4");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.res.status).toBe(403);
    const body = (await out.res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("rejects malformed Origin (not a URL)", async () => {
    const req = makeReq({
      host: "app.example.com",
      origin: "not-a-url",
    });
    const out = checkSameOrigin(req, "req_test_5");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.res.status).toBe(403);
  });

  it("uses x-forwarded-host over host when present (Vercel proxy path)", () => {
    const req = makeReq({
      host: "internal-vercel-host.local",
      "x-forwarded-host": "app.example.com",
      origin: "https://app.example.com",
    });
    const out = checkSameOrigin(req, "req_test_6");
    expect(out.ok).toBe(true);
  });

  it("is case-insensitive on host comparison", () => {
    const req = makeReq({
      host: "App.Example.com",
      origin: "https://APP.example.com",
    });
    const out = checkSameOrigin(req, "req_test_7");
    expect(out.ok).toBe(true);
  });

  // review-009 N001: scheme check, conditional on x-forwarded-proto.
  it("rejects scheme mismatch when x-forwarded-proto is present", async () => {
    const req = makeReq({
      host: "app.example.com",
      "x-forwarded-proto": "https",
      origin: "http://app.example.com",
    });
    const out = checkSameOrigin(req, "req_test_8");
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.res.status).toBe(403);
    const body = (await out.res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  it("passes scheme + host match when x-forwarded-proto is present", () => {
    const req = makeReq({
      host: "app.example.com",
      "x-forwarded-proto": "https",
      origin: "https://app.example.com",
    });
    const out = checkSameOrigin(req, "req_test_9");
    expect(out.ok).toBe(true);
  });

  it("uses the left-most entry of a comma-separated x-forwarded-proto chain", () => {
    const req = makeReq({
      host: "app.example.com",
      "x-forwarded-proto": "https, http",
      origin: "https://app.example.com",
    });
    const out = checkSameOrigin(req, "req_test_10");
    expect(out.ok).toBe(true);
  });

  it("falls back to host-only when x-forwarded-proto is absent (cURL / local dev)", () => {
    // Without a forwarded-proto, the receiving scheme is unknowable. We
    // accept either to keep the README cookie-jar walkthrough working.
    const req = makeReq({
      host: "app.example.com",
      origin: "http://app.example.com",
    });
    const out = checkSameOrigin(req, "req_test_11");
    expect(out.ok).toBe(true);
  });
});
