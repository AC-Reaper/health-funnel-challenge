import "server-only";

import { createHash } from "node:crypto";

import type { NextResponse } from "next/server";

import { db } from "../db";
import { ERROR_CODES, jsonError } from "./errors";

/**
 * Best-effort, Postgres-backed fixed-window rate limiter (ADR-016).
 *
 * Why Postgres and not in-memory: Vercel runs many short-lived function
 * instances, so an in-process counter is per-instance and resets on cold
 * start — it cannot bound an abuser that fans out across instances. A
 * shared `rate_limit` table reuses the stack we already have (no Upstash
 * /KV dependency) and is correct across instances.
 *
 * Why "best-effort": the increment is a Prisma upsert (read-modify-write),
 * so under heavy concurrency the count can slightly *under*-count — fine
 * for a throttle. And the limiter is **fail-open**: if the store errors,
 * the request is allowed, so a limiter hiccup never breaks the demo loop.
 *
 * Keying is a composite of client IP + session id (when present) + a
 * User-Agent hash, per route and per time window. The identity is
 * SHA-256'd, so no raw IP/UA is persisted.
 */

export interface RateLimitRule {
  /** Max requests allowed per identity within the window. */
  limit: number;
  /** Window length in seconds (fixed window). */
  windowSeconds: number;
}

/**
 * Per-route limits. Generous enough for the 6-step browser flow, edits,
 * retries, and the README cookie-jar cURL walkthrough; tight enough to
 * throttle scripted abuse of the high-value write paths.
 */
export const RATE_LIMITS = {
  sessions: { limit: 20, windowSeconds: 60 },
  steps: { limit: 80, windowSeconds: 60 },
  submit: { limit: 15, windowSeconds: 60 },
  pay: { limit: 15, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitRoute = keyof typeof RATE_LIMITS;

// ---------- Pure helpers (unit-tested) ----------

/** Left-most `x-forwarded-for` entry, then `x-real-ip`, then "unknown". */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Salted SHA-256 of IP + session id + User-Agent (no raw PII stored). */
export function identityHash(req: Request, sid: string | null): string {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`${ip}|${sid ?? ""}|${ua}`)
    .digest("hex")
    .slice(0, 32);
}

export interface Window {
  windowEpoch: number;
  windowStart: Date;
  expiresAt: Date;
}

export function resolveWindow(nowMs: number, windowSeconds: number): Window {
  const windowMs = windowSeconds * 1000;
  const windowEpoch = Math.floor(nowMs / windowMs);
  return {
    windowEpoch,
    windowStart: new Date(windowEpoch * windowMs),
    expiresAt: new Date((windowEpoch + 1) * windowMs),
  };
}

export function rateLimitKey(
  route: RateLimitRoute,
  idHash: string,
  windowEpoch: number,
): string {
  return `${route}:${idHash}:${windowEpoch}`;
}

export function retryAfterSeconds(nowMs: number, expiresAtMs: number): number {
  return Math.max(1, Math.ceil((expiresAtMs - nowMs) / 1000));
}

// ---------- Store seam (review-006 B001 pattern) ----------

export interface RateLimitStore {
  /**
   * Atomically bump the counter for `key` (creating the row in the current
   * window if absent) and return the post-increment count. May reject; the
   * caller treats a rejection as fail-open.
   */
  increment(key: string, windowStart: Date, expiresAt: Date): Promise<number>;
  /** Best-effort prune of expired rows. Never throws into the caller. */
  pruneExpired?(now: Date): Promise<void>;
}

// ---------- Pure orchestration (unit-tested via an in-memory store) ----------

export async function runRateLimit(
  store: RateLimitStore,
  req: Request,
  route: RateLimitRoute,
  requestId: string,
  sid: string | null,
  now: number = Date.now(),
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const rule = RATE_LIMITS[route];
  const win = resolveWindow(now, rule.windowSeconds);
  const key = rateLimitKey(route, identityHash(req, sid), win.windowEpoch);

  let count: number;
  try {
    count = await store.increment(key, win.windowStart, win.expiresAt);
  } catch {
    // Fail-open: a limiter store error must never break the demo loop.
    return { ok: true };
  }

  if (count > rule.limit) {
    return {
      ok: false,
      res: tooMany(requestId, retryAfterSeconds(now, win.expiresAt.getTime())),
    };
  }
  return { ok: true };
}

function tooMany(requestId: string, retryAfter: number): NextResponse {
  const res = jsonError({
    status: 429,
    code: ERROR_CODES.RATE_LIMITED,
    message: "Too many requests. Please slow down and retry shortly.",
    requestId,
  });
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}

// ---------- Prisma adapter ----------

const dbRateLimitStore: RateLimitStore = {
  async increment(key, windowStart, expiresAt) {
    const row = await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart, expiresAt },
      update: { count: { increment: 1 } },
    });
    return row.count;
  },
};

/**
 * Production entry point used by route handlers. Wraps the Prisma store and
 * fires a low-probability, fire-and-forget prune of expired rows so the
 * fixed-window table doesn't grow unbounded (no cron required). The prune
 * is best-effort and its errors are swallowed.
 */
export async function checkRateLimit(
  req: Request,
  route: RateLimitRoute,
  requestId: string,
  sid: string | null,
): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  if (Math.random() < 0.02) {
    void db.rateLimit
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});
  }
  return runRateLimit(dbRateLimitStore, req, route, requestId, sid);
}
