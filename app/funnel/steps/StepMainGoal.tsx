"use client";

import { useState } from "react";

import type { SessionAnswersDTO } from "@/lib/session";

import { OptionCard, StepShell } from "./StepShell";

type MainGoal = NonNullable<SessionAnswersDTO["mainGoal"]>;

const OPTIONS: { value: MainGoal; label: string; description: string }[] = [
  { value: "lose_weight", label: "Lose weight", description: "~0.5 kg / week deficit" },
  { value: "maintain", label: "Maintain", description: "Stay around current weight" },
  { value: "gain_weight", label: "Gain weight", description: "~0.5 kg / week surplus" },
  { value: "build_muscle", label: "Build muscle", description: "Slow lean gain (~0.25 kg / week)" },
];

interface StepMainGoalProps {
  initial: MainGoal | undefined;
  pending: boolean;
  error: string | null;
  onSave: (body: { mainGoal: MainGoal }) => Promise<void>;
}

export function StepMainGoal({ initial, pending, error, onSave }: StepMainGoalProps) {
  const [value, setValue] = useState<MainGoal | undefined>(initial);

  return (
    <StepShell
      title="What's your main goal?"
      pending={pending}
      error={error}
      canContinue={value !== undefined}
      onContinue={() => value && onSave({ mainGoal: value })}
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
