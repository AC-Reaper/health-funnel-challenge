import type { StepKey } from "@prisma/client";

import type { SessionDTO } from "@/lib/session";

export interface PatchOk {
  ok: true;
  dto: SessionDTO;
}

export interface PatchErr {
  ok: false;
  status: number;
  code?: string;
  message: string;
  fields?: Record<string, string | string[]>;
}

export type PatchResult = PatchOk | PatchErr;

interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string | string[]>;
  };
}

/**
 * Single source of truth for funnel HTTP from the client. Wraps fetch with
 * the same-origin cookie and a tight result shape: caller pattern-matches
 * on `.ok` instead of try/catching JSON.
 */
export async function patchStep(
  stepKey: StepKey,
  body: Record<string, unknown>,
): Promise<PatchResult> {
  const res = await fetch(`/api/v1/sessions/me/steps/${stepKey}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  if (res.ok) {
    const dto = (await res.json()) as SessionDTO;
    return { ok: true, dto };
  }

  const env = (await res.json().catch(() => ({}))) as ApiErrorEnvelope;
  return {
    ok: false,
    status: res.status,
    code: env.error?.code,
    message: env.error?.message ?? `Request failed (${res.status})`,
    fields: env.error?.fields,
  };
}

export async function submitAssessment(): Promise<PatchResult> {
  const res = await fetch("/api/v1/sessions/me/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    credentials: "same-origin",
  });
  if (res.ok) {
    const dto = (await res.json()) as SessionDTO;
    return { ok: true, dto };
  }
  const env = (await res.json().catch(() => ({}))) as ApiErrorEnvelope;
  return {
    ok: false,
    status: res.status,
    code: env.error?.code,
    message: env.error?.message ?? `Submit failed (${res.status})`,
    fields: env.error?.fields,
  };
}

export async function recreateSession(): Promise<boolean> {
  const res = await fetch("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    credentials: "same-origin",
  });
  return res.ok;
}
