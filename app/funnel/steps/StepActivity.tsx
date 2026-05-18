"use client";

import { useState } from "react";

import type { SessionAnswersDTO } from "@/lib/session";

import { OptionCard, StepShell } from "./StepShell";

type ActivityLevel = NonNullable<SessionAnswersDTO["activityLevel"]>;

const OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: "sedentary", label: "Sedentary", description: "Little to no exercise" },
  { value: "light", label: "Light", description: "1–3 sessions per week" },
  { value: "moderate", label: "Moderate", description: "3–5 sessions per week" },
  { value: "active", label: "Active", description: "6–7 sessions per week" },
  { value: "very_active", label: "Very active", description: "Twice a day or hard labor" },
];

interface StepActivityProps {
  initial: ActivityLevel | undefined;
  pending: boolean;
  error: string | null;
  onSave: (body: { activityLevel: ActivityLevel }) => Promise<void>;
}

export function StepActivity({ initial, pending, error, onSave }: StepActivityProps) {
  const [value, setValue] = useState<ActivityLevel | undefined>(initial);

  return (
    <StepShell
      title="How active are you?"
      hint="Drives the calorie estimate."
      pending={pending}
      error={error}
      canContinue={value !== undefined}
      onContinue={() => value && onSave({ activityLevel: value })}
      continueLabel="See my plan"
    >
      {OPTIONS.map((o) => (
        <OptionCard
          key={o.value}
          selected={value === o.value}
          onSelect={() => setValue(o.value)}
          label={o.label}
          description={o.description}
        />
      ))}
    </StepShell>
  );
}
