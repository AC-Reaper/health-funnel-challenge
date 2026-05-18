import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonBody } from "@/lib/api/parse-body";

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

  it("returns typed parsed data on success", async () => {
    const req = jsonReq('{"name":"alice","age":30}');
    const result = await parseJsonBody(req, schema, REQUEST_ID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ name: "alice", age: 30 });
  });
});
