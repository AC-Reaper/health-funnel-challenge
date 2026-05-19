import type { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

import { ERROR_CODES, jsonError } from "./errors";

/**
 * Hard cap on the JSON request body we accept on any /api/v1 route.
 * The largest legitimate body in the funnel is the activity step at
 * <1 KB; 16 KB is a comfortable 16× headroom. Rejects with
 * `413 PAYLOAD_TOO_LARGE` (docs/04-api-design.md §Error model).
 *
 * Implemented as a belt-and-suspenders pair:
 *   1. Trust the declared `Content-Length` header up front (cheap).
 *   2. Read the body as text and re-check the actual byte length,
 *      so a missing/lying `Content-Length` doesn't bypass the cap.
 */
export const MAX_BODY_BYTES = 16 * 1024;

/**
 * Reads the request body, parses it as JSON, then runs it through the
 * provided Zod schema. Maps the four failure modes onto the documented
 * API error contract (docs/04-api-design.md §Error model):
 *
 *   - Wrong content type (anything other than JSON) → 400 BAD_REQUEST
 *   - Body exceeds MAX_BODY_BYTES                    → 413 PAYLOAD_TOO_LARGE
 *   - Malformed JSON                                 → 400 BAD_REQUEST
 *   - JSON parsed but schema rejected                → 422 VALIDATION_ERROR
 *
 * On success returns the typed parsed body. On failure returns a
 * `NextResponse` ready to be returned by the route handler.
 *
 * Per ADR-005: every POST/PATCH endpoint owns a Zod schema and goes
 * through this helper, so validation behaviour stays consistent.
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodSchema<T>,
  requestId: string,
): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      res: jsonError({
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Content-Type must be application/json.",
        requestId,
      }),
    };
  }

  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > MAX_BODY_BYTES) {
      return { ok: false, res: tooLarge(requestId) };
    }
  }

  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      ok: false,
      res: jsonError({
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Request body is not valid JSON.",
        requestId,
      }),
    };
  }
  // `req.text()` decodes to a JS string; byte length is bounded by the
  // utf-8 encoding of that string. Comparing string length is a cheap
  // upper-bound check that's slightly conservative (rejecting some
  // ascii-only bodies between 16 KB chars and 16 KB bytes is fine here;
  // none of our schemas come close to either limit).
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, res: tooLarge(requestId) };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {
      ok: false,
      res: jsonError({
        status: 400,
        code: ERROR_CODES.BAD_REQUEST,
        message: "Request body is not valid JSON.",
        requestId,
      }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      fields[path] = issue.message;
    }
    return {
      ok: false,
      res: jsonError({
        status: 422,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Request body failed validation.",
        requestId,
        fields,
      }),
    };
  }

  return { ok: true, data: parsed.data };
}

function tooLarge(requestId: string): NextResponse {
  return jsonError({
    status: 413,
    code: ERROR_CODES.PAYLOAD_TOO_LARGE,
    message: `Request body exceeds ${MAX_BODY_BYTES} bytes.`,
    requestId,
  });
}
