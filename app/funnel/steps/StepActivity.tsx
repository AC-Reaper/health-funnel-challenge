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
  const wasPendingRef = useRef(pending);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // review-008 I001: clear `selecting` on a pending true→false transition
  // so failed PATCH or failed /submit doesn't leave the step disabled.
  // Especially important here since activity also chains into /submit;
  // either step failing leaves us mounted on this view.
  useEffect(() => {
    if (wasPendingRef.current && !pending) setSelecting(null);
    wasPendingRef.current = pending;
  }, [pending]);

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
