"use client";

import { useState } from "react";

import { NumberField, StepShell } from "./StepShell";

interface StepWeightProps {
  initialWeight: number | undefined;
  initialTarget: number | undefined;
  pending: boolean;
  error: string | null;
  fields: Record<string, string | string[]> | undefined;
  onSave: (body: { weightKg: number; targetWeightKg: number }) => Promise<void>;
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

export function StepWeight({
  initialWeight,
  initialTarget,
  pending,
  error,
  fields,
  onSave,
}: StepWeightProps) {
  const [w, setW] = useState<number | "">(initialWeight ?? "");
  const [t, setT] = useState<number | "">(initialTarget ?? "");

  const wValid = typeof w === "number" && w >= 30 && w <= 250;
  const tValid = typeof t === "number" && t >= 30 && t <= 250;
  const canContinue = wValid && tValid;

  return (
    <StepShell
      title="Your weight today and your goal"
      hint="We use these to plan a safe weekly curve."
      pending={pending}
      error={error}
      canContinue={canContinue}
      onContinue={() =>
        canContinue && onSave({ weightKg: w as number, targetWeightKg: t as number })
      }
    >
      <NumberField
        id="weightKg"
        label="Current weight"
        unit="kg"
        min={30}
        max={250}
        step={0.1}
        value={w}
        onChange={setW}
        error={pickFieldMessage(fields, "weightKg")}
      />
      <NumberField
        id="targetWeightKg"
        label="Goal weight"
        unit="kg"
        min={30}
        max={250}
        step={0.1}
        value={t}
        onChange={setT}
        error={pickFieldMessage(fields, "targetWeightKg")}
      />
    </StepShell>
  );
}
