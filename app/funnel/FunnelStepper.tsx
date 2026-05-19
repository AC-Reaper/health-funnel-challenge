"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { StepKey } from "@prisma/client";

import { STEP_ORDER } from "@/lib/progress";
import type { SessionDTO } from "@/lib/session";

import { ProgressBar } from "./ProgressBar";
import {
  type PatchResult,
  patchStep,
  recreateSession,
  submitAssessment,
} from "./lib/patchStep";
import { StepActivity } from "./steps/StepActivity";
import { StepAge } from "./steps/StepAge";
import { StepGender } from "./steps/StepGender";
import { StepHeight } from "./steps/StepHeight";
import { StepMainGoal } from "./steps/StepMainGoal";
import { StepWeight } from "./steps/StepWeight";

interface FunnelStepperProps {
  bootstrap: SessionDTO;
}

function pickFieldMessage(
  fields: Record<string, string | string[]> | undefined,
  key: string,
): string | undefined {
  const v = fields?.[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

function prevStep(s: StepKey): StepKey | null {
  const i = STEP_ORDER.indexOf(s);
  return i > 0 ? (STEP_ORDER[i - 1] as StepKey) : null;
}

function nextStep(s: StepKey): StepKey | null {
  const i = STEP_ORDER.indexOf(s);
  return i < STEP_ORDER.length - 1 ? (STEP_ORDER[i + 1] as StepKey) : null;
}

export function FunnelStepper({ bootstrap }: FunnelStepperProps) {
  const router = useRouter();
  const [dto, setDto] = useState<SessionDTO>(bootstrap);
  const [viewStep, setViewStep] = useState<StepKey>(bootstrap.currentStep);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<
    Record<string, string | string[]> | undefined
  >(undefined);

  async function callPatch(
    stepKey: StepKey,
    body: Record<string, unknown>,
  ): Promise<PatchResult> {
    let res = await patchStep(stepKey, body);
    if (!res.ok && (res.code === "NO_SESSION" || res.status === 404)) {
      const recovered = await recreateSession();
      if (recovered) res = await patchStep(stepKey, body);
    }
    return res;
  }

  async function handleSave(stepKey: StepKey, body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setFields(undefined);

    const res = await callPatch(stepKey, body);
    if (!res.ok) {
      setPending(false);
      if (res.code === "ALREADY_SUBMITTED") {
        router.push("/results");
        return;
      }
      setError(res.message);
      setFields(res.fields);
      return;
    }

    setDto(res.dto);

    if (stepKey === "activity") {
      const submitRes = await submitAssessment();
      setPending(false);
      if (!submitRes.ok) {
        if (submitRes.code === "ALREADY_SUBMITTED") {
          router.push("/results");
          return;
        }
        setError(submitRes.message);
        setFields(submitRes.fields);
        return;
      }
      router.push("/results");
      return;
    }

    const advance = nextStep(stepKey);
    if (advance) setViewStep(advance);
    setPending(false);
  }

  function handleBack() {
    if (pending) return;
    setError(null);
    setFields(undefined);
    const prev = prevStep(viewStep);
    if (prev) setViewStep(prev);
  }

  if (dto.submitted) {
    router.replace("/results");
    return null;
  }

  const onBack = prevStep(viewStep) ? handleBack : undefined;

  return (
    <div className="space-y-8">
      <ProgressBar viewStep={viewStep} submitted={dto.submitted} />

      {viewStep === "gender" ? (
        <StepGender
          initial={dto.answers.gender ?? undefined}
          pending={pending}
          error={error}
          onSave={(b) => handleSave("gender", b)}
          onBack={onBack}
        />
      ) : viewStep === "main_goal" ? (
        <StepMainGoal
          initial={dto.answers.mainGoal ?? undefined}
          pending={pending}
          error={error}
          onSave={(b) => handleSave("main_goal", b)}
          onBack={onBack}
        />
      ) : viewStep === "age" ? (
        <StepAge
          initial={dto.answers.ageYears}
          pending={pending}
          error={error}
          fieldError={pickFieldMessage(fields, "ageYears")}
          onSave={(b) => handleSave("age", b)}
          onBack={onBack}
        />
      ) : viewStep === "height" ? (
        <StepHeight
          initial={dto.answers.heightCm}
          pending={pending}
          error={error}
          fieldError={pickFieldMessage(fields, "heightCm")}
          onSave={(b) => handleSave("height", b)}
          onBack={onBack}
        />
      ) : viewStep === "weight" ? (
        <StepWeight
          initialWeight={dto.answers.weightKg}
          initialTarget={dto.answers.targetWeightKg}
          pending={pending}
          error={error}
          fields={fields}
          onSave={(b) => handleSave("weight", b)}
          onBack={onBack}
        />
      ) : (
        <StepActivity
          initial={dto.answers.activityLevel ?? undefined}
          pending={pending}
          error={error}
          onSave={(b) => handleSave("activity", b)}
          onBack={onBack}
        />
      )}
    </div>
  );
}
