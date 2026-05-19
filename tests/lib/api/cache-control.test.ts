import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";

import { NO_STORE, withNoStore } from "@/lib/api/cache-control";

describe("withNoStore", () => {
  it("sets Cache-Control: private, no-store, max-age=0 on success responses", () => {
    const res = NextResponse.json({ ok: true });
    const out = withNoStore(res);
    expect(out.headers.get("Cache-Control")).toBe(NO_STORE);
    expect(out.headers.get("Cache-Control")).toBe(
      "private, no-store, max-age=0",
    );
  });

  it("overwrites a pre-existing Cache-Control header (last-write-wins)", () => {
    const res = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "public, max-age=3600" } },
    );
    withNoStore(res);
    expect(res.headers.get("Cache-Control")).toBe(NO_STORE);
  });
});
