"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionAnswersDTO } from "@/lib/session";

import { OptionCard, StepShell } from "./StepShell";

type ActivityLevel = NonNullable<SessionAnswersDTO["activityLevel"]>;

const AUTO_ADVANCE_MS = 250;

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
  onBack?: () => void;
}

export function StepActivity({
  initial,
  pending,
  error,
  onSave,
  onBack,
}: StepActivityProps) {
  const [value, setValue] = useState<ActivityLevel | undefined>(initial);
  const [selecting, setSelecting] = useState<ActivityLevel | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function pick(v: ActivityLevel) {
    if (pending || selecting) return;
    setValue(v);
    setSelecting(v);
    timerRef.current = setTimeout(() => {
      void onSave({ activityLevel: v });
    }, AUTO_ADVANCE_MS);
  }

  return (
    <StepShell
      title="How active are you?"
      hint="Drives the calorie estimate. Picking this finishes the quiz."
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
