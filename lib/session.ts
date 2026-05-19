import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import type { Assessment, Session, StepKey } from "@prisma/client";

import { db } from "./db";
import { env } from "./env";
import { computeCurrentStep } from "./progress";

export const COOKIE_NAME = "hfc_session";
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const SIG_HEX_LENGTH = 64;
/**
 * Tolerance for clock skew between the signing host and the verifying host.
 * 60s is small enough that a clock-skew abuser still loses TTL headroom and
 * large enough that a healthy NTP-synced fleet never trips the future-iat
 * branch.
 */
const COOKIE_CLOCK_SKEW_SECONDS = 60;

// ---------- Cookie sign / verify (pure) ----------

interface CookiePayload {
  sid: string;
  iat: number;
  sig: string;
}

function hmac(sid: string, iat: number): string {
  return createHmac("sha256", env.SESSION_COOKIE_SECRET)
    .update(`${sid}.${iat}`)
    .digest("hex");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function signCookie(sid: string): string {
  const iat = nowSeconds();
  const payload: CookiePayload = { sid, iat, sig: hmac(sid, iat) };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decode and verify a cookie value. Returns the session id on success, or
 * `null` for any failure mode (missing, malformed base64url, malformed JSON,
 * missing fields, wrong-length signature, signature mismatch, missing/invalid
 * `iat`, future-dated `iat`, or `iat` older than COOKIE_MAX_AGE_SECONDS).
 */
export function verifyCookie(raw: string | undefined): string | null {
  if (!raw) return null;

  let json: string;
  try {
    json = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as Record<string, unknown>).sid !== "string" ||
    typeof (parsed as Record<string, unknown>).iat !== "number" ||
    typeof (parsed as Record<string, unknown>).sig !== "string"
  ) {
    return null;
  }

  const { sid, iat, sig } = parsed as CookiePayload;
  if (!Number.isInteger(iat)) return null;
  if (sig.length !== SIG_HEX_LENGTH) return null;

  const now = nowSeconds();
  if (iat > now + COOKIE_CLOCK_SKEW_SECONDS) return null;
  if (now - iat > COOKIE_MAX_AGE_SECONDS) return null;

  const expected = Buffer.from(hmac(sid, iat), "hex");
  const provided = Buffer.from(sig, "hex");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  return sid;
}

export function buildSetCookieHeader(sid: string): string {
  const parts = [
    `${COOKIE_NAME}=${signCookie(sid)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

// ---------- Repository (I/O) ----------

export async function createSession(params: {
  userAgent?: string;
}): Promise<Session> {
  return db.session.create({
    data: {
      id: randomUUID(),
      userAgent: params.userAgent ?? null,
    },
  });
}

export async function findSessionById(sid: string): Promise<Session | null> {
  return db.session.findUnique({ where: { id: sid } });
}

export async function findAssessmentBySessionId(
  sid: string,
): Promise<Assessment | null> {
  return db.assessment.findUnique({ where: { sessionId: sid } });
}

// ---------- Wire serialisation ----------

export interface SessionAnswersDTO {
  gender?: Assessment["gender"];
  mainGoal?: Assessment["mainGoal"];
  ageYears?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  activityLevel?: Assessment["activityLevel"];
}

export interface SessionDTO {
  sessionId: string;
  status: Session["status"];
  currentStep: StepKey;
  entitlementStatus: Session["entitlementStatus"];
  submitted: boolean;
  createdAt: string;
  answers: SessionAnswersDTO;
}

export function serializeSession(
  session: Session,
  assessment: Assessment | null,
): SessionDTO {
  const answers: SessionAnswersDTO = {};
  if (assessment) {
    if (assessment.gender !== null) answers.gender = assessment.gender;
    if (assessment.mainGoal !== null) answers.mainGoal = assessment.mainGoal;
    if (assessment.ageYears !== null) answers.ageYears = assessment.ageYears;
    if (assessment.heightCm !== null) answers.heightCm = assessment.heightCm;
    if (assessment.weightKg !== null) {
      answers.weightKg = Number(assessment.weightKg);
    }
    if (assessment.targetWeightKg !== null) {
      answers.targetWeightKg = Number(assessment.targetWeightKg);
    }
    if (assessment.activityLevel !== null) {
      answers.activityLevel = assessment.activityLevel;
    }
  }

  return {
    sessionId: session.id,
    status: session.status,
    currentStep: computeCurrentStep(assessment),
    entitlementStatus: session.entitlementStatus,
    submitted: session.status === "submitted",
    createdAt: session.createdAt.toISOString(),
    answers,
  };
}
