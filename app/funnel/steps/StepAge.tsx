"use client";

import { useState } from "react";

import { NumberField, StepShell } from "./StepShell";

interface StepAgeProps {
  initial: number | undefined;
  pending: boolean;
  error: string | null;
  fieldError?: string;
  onSave: (body: { ageYears: number }) => Promise<void>;
  onBack?: () => void;
}

export function StepAge({
  initial,
  pending,
  error,
  fieldError,
  onSave,
  onBack,
}: StepAgeProps) {
  const [value, setValue] = useState<number | "">(initial ?? "");
  const canContinue = typeof value === "number" && value >= 13 && value <= 100;

  return (
    <StepShell
      title="How old are you?"
      pending={pending}
      error={error}
      canContinue={canContinue}
      onContinue={() => canContinue && onSave({ ageYears: value })}
      onBack={onBack}
    >
      <NumberField
        id="ageYears"
        label="Age"
        unit="years"
        min={13}
        max={100}
        value={value}
        onChange={setValue}
        error={fieldError}
      />
    </StepShell>
  );
}
