import { describe, expect, it } from "vitest";
import { z } from "zod";

import { MAX_BODY_BYTES, parseJsonBody } from "@/lib/api/parse-body";

const schema = z
  .object({ name: z.string().min(1), age: z.number().int().min(0) })
  .strict();

const REQUEST_ID = "req_test_00000000-0000-0000-0000-000000000000";

function jsonReq(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/api/v1/test", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("parseJsonBody", () => {
  it("returns BAD_REQUEST when Content-Type is missing", async () => {
    const req = new Request("http://localhost/api/v1/test", {
      method: "POST",
      body: '{"name":"x","age":1}',
    });
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(400);
    const body = await result.res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.requestId).toBe(REQUEST_ID);
  });

  it("returns BAD_REQUEST for wrong Content-Type", async () => {
    const req = jsonReq('{"name":"x","age":1}', "text/plain");
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(400);
  });

  it("returns BAD_REQUEST for malformed JSON", async () => {
    const req = jsonReq("not json");
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(400);
    const body = await result.res.json();
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.message).toMatch(/valid JSON/);
  });

  it("returns VALIDATION_ERROR for schema failure with field map", async () => {
    const req = jsonReq('{"name":"","age":-1}');
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(422);
    const body = await result.res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields).toBeDefined();
    expect(body.error.fields.name).toBeDefined();
    expect(body.error.fields.age).toBeDefined();
  });

  it("returns VALIDATION_ERROR for unknown keys via .strict()", async () => {
    const req = jsonReq('{"name":"x","age":1,"bonus":true}');
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(422);
  });

  it("rejects with 413 when Content-Length declares a body over the cap", async () => {
    const oversized = "x".repeat(MAX_BODY_BYTES + 1);
    const req = new Request("http://localhost/api/v1/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(oversized.length + 100),
      },
      body: JSON.stringify({ name: "a", age: 1 }),
    });
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(413);
    const body = await result.res.json();
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects with 413 when the actual body exceeds the cap (no Content-Length)", async () => {
    const filler = "x".repeat(MAX_BODY_BYTES + 100);
    const oversized = JSON.stringify({ name: filler, age: 1 });
    const req = new Request("http://localhost/api/v1/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(413);
    const body = await result.res.json();
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects with 413 when a multibyte body exceeds the byte cap under the char count", async () => {
    // "€" is 1 UTF-16 code unit but 3 UTF-8 bytes. Pick a count that
    // keeps text.length <= MAX_BODY_BYTES while pushing the UTF-8 byte
    // length over it — proves the cap is byte-accurate, not char-based.
    const euros = "€".repeat(Math.ceil(MAX_BODY_BYTES / 2));
    expect(euros.length).toBeLessThanOrEqual(MAX_BODY_BYTES);
    const oversized = JSON.stringify({ name: euros, age: 1 });
    expect(Buffer.byteLength(oversized, "utf8")).toBeGreaterThan(
      MAX_BODY_BYTES,
    );
    const req = new Request("http://localhost/api/v1/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: oversized,
    });
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.res.status).toBe(413);
    const body = await result.res.json();
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("accepts bodies just under the cap", async () => {
    // Build a JSON body that fits within MAX_BODY_BYTES end-to-end.
    const padding = "y".repeat(MAX_BODY_BYTES - 64);
    const req = jsonReq(JSON.stringify({ name: padding, age: 1 }));
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(true);
  });

  it("returns typed parsed data on success", async () => {
    const req = jsonReq('{"name":"alice","age":30}');
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ name: "alice", age: 30 });
  });
});
