import { z } from "zod";

/**
 * Idempotency-Key validator for `POST /api/v1/pay`.
 *
 * - **Length**: 1-128 chars (matches `Payment.idempotencyKey VARCHAR(128)`
 *   in `prisma/schema.prisma`, ADR-006).
 * - **Charset**: printable ASCII only (`\x20-\x7E`). UUID v4, base64,
 *   hex, and human-readable keys all fit. Rejected:
 *   - control characters (\x00-\x1F, \x7F) — would corrupt logs;
 *   - embedded newlines / tabs — log-poisoning vector;
 *   - non-ASCII / Unicode — the DB column is ASCII-shaped.
 *
 * The DB column's `VARCHAR(128)` width is the second line of defense
 * if validation regresses.
 */
export const IDEMPOTENCY_KEY_SCHEMA = z
  .string()
  .min(1, "Idempotency-Key required")
  .max(128, "Idempotency-Key max 128 chars")
  .regex(/^[\x20-\x7E]+$/, "Idempotency-Key must be printable ASCII");
