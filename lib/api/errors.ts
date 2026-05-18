import { NextResponse } from "next/server";

/**
 * Stable machine-readable error codes from docs/04-api-design.md §Error model.
 * Add new codes here and reference them by name from route handlers.
 */
export const ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  NO_SESSION: "NO_SESSION",
  NOT_FOUND: "NOT_FOUND",
  STEP_OUT_OF_ORDER: "STEP_OUT_OF_ORDER",
  NOT_SUBMITTED: "NOT_SUBMITTED",
  ALREADY_SUBMITTED: "ALREADY_SUBMITTED",
  ALREADY_PAID: "ALREADY_PAID",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INCOMPLETE_ASSESSMENT: "INCOMPLETE_ASSESSMENT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    requestId: string;
  };
}

interface JsonErrorParams {
  status: number;
  code: ErrorCode;
  message: string;
  requestId: string;
  fields?: Record<string, string>;
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
    headers: { "x-request-id": requestId },
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
