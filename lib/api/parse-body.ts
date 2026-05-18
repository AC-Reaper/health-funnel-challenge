import type { NextResponse } from "next/server";
import type { ZodSchema } from "zod";

import { ERROR_CODES, jsonError } from "./errors";

/**
 * Reads the request body, parses it as JSON, then runs it through the
 * provided Zod schema. Maps the three failure modes onto the documented
 * API error contract (docs/04-api-design.md §Error model):
 *
 *   - Wrong content type (anything other than JSON) → 400 BAD_REQUEST
 *   - Malformed JSON                                → 400 BAD_REQUEST
 *   - JSON parsed but schema rejected               → 422 VALIDATION_ERROR
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

  let raw: unknown;
  try {
    raw = await req.json();
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
