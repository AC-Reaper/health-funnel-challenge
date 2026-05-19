import { NextResponse } from "next/server";

import { NO_STORE } from "./cache-control";

/**
 * Stable machine-readable error codes from docs/04-api-design.md §Error model.
 * Add new codes here and reference them by name from route handlers.
 */
export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  NO_SESSION: "NO_SESSION",
  FORBIDDEN_ORIGIN: "FORBIDDEN_ORIGIN",
  NOT_FOUND: "NOT_FOUND",
  STEP_OUT_OF_ORDER: "STEP_OUT_OF_ORDER",
  NOT_SUBMITTED: "NOT_SUBMITTED",
  ALREADY_SUBMITTED: "ALREADY_SUBMITTED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INCOMPLETE_ASSESSMENT: "INCOMPLETE_ASSESSMENT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Shape of the `fields` map in a validation/incomplete error. String values
 * are field-level messages (e.g. `{ ageYears: "must be 13..100" }`); string
 * arrays carry lists (e.g. `{ missingSteps: ["weight","activity"] }` for
 * `INCOMPLETE_ASSESSMENT`, per docs/04-api-design.md §4).
 */
export type ErrorFields = Record<string, string | string[]>;

interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    fields?: ErrorFields;
    requestId: string;
  };
}

interface JsonErrorParams {
  status: number;
  code: ErrorCode;
  message: string;
  requestId: string;
  fields?: ErrorFields;
}

export function jsonError({
  status,
  code,
  message,
  requestId,
  fields,
}: JsonErrorParams): NextResponse {
  const body: ErrorEnvelope = {
    error: { code, message, requestId, ...(fields ? { fields } : {}) },
  };
  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": requestId, "Cache-Control": NO_STORE },
  });
}

export function noSession(requestId: string): NextResponse {
  return jsonError({
    status: 401,
    code: ERROR_CODES.NO_SESSION,
    message: "No valid session cookie.",
    requestId,
  });
}

export function internalError(requestId: string): NextResponse {
  return jsonError({
    status: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: "Unexpected server error.",
    requestId,
  });
}
