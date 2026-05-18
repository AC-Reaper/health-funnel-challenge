"use client";

import { useState } from "react";

import { NumberField, StepShell } from "./StepShell";

interface StepHeightProps {
  initial: number | undefined;
  pending: boolean;
  error: string | null;
  fieldError?: string;
  onSave: (body: { heightCm: number }) => Promise<void>;
}

export function StepHeight({
  initial,
  pending,
  error,
  fieldError,
  onSave,
}: StepHeightProps) {
  const [value, setValue] = useState<number | "">(initial ?? "");
  const canContinue = typeof value === "number" && value >= 120 && value <= 230;

  return (
    <StepShell
      title="How tall are you?"
      pending={pending}
      error={error}
      canContinue={canContinue}
      onContinue={() => canContinue && onSave({ heightCm: value })}
    >
      <NumberField
        id="heightCm"
        label="Height"
        unit="cm"
        min={120}
        max={230}
        value={value}
        onChange={setValue}
        error={fieldError}
      />
    </StepShell>
  );
}
