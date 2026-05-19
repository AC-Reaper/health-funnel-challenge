"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionAnswersDTO } from "@/lib/session";

import { OptionCard, StepShell } from "./StepShell";

type MainGoal = NonNullable<SessionAnswersDTO["mainGoal"]>;

const AUTO_ADVANCE_MS = 250;

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
  onBack?: () => void;
}

export function StepMainGoal({
  initial,
  pending,
  error,
  onSave,
  onBack,
}: StepMainGoalProps) {
  const [value, setValue] = useState<MainGoal | undefined>(initial);
  const [selecting, setSelecting] = useState<MainGoal | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function pick(v: MainGoal) {
    if (pending || selecting) return;
    setValue(v);
    setSelecting(v);
    timerRef.current = setTimeout(() => {
      void onSave({ mainGoal: v });
    }, AUTO_ADVANCE_MS);
  }

  return (
    <StepShell
      title="What's your main goal?"
      pending={pending}
      error={error}
      canContinue={false}
      autoAdvance
      onBack={onBack}
    >
      {OPTIONS.map((o) => (
        <OptionCard
          key={o.value}
          selected={value === o.value}
          selecting={selecting === o.value}
          disabled={pending || selecting !== null}
          onSelect={() => pick(o.value)}
          label={o.label}
          description={o.description}
        />
      ))}
    </StepShell>
  );
}
