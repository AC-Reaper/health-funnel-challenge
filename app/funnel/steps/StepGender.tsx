"use client";

import { useEffect, useRef, useState } from "react";

import type { SessionAnswersDTO } from "@/lib/session";

import { OptionCard, StepShell } from "./StepShell";

type Gender = NonNullable<SessionAnswersDTO["gender"]>;

const AUTO_ADVANCE_MS = 250;

interface StepGenderProps {
  initial: Gender | undefined;
  pending: boolean;
  error: string | null;
  onSave: (body: { gender: Gender }) => Promise<void>;
  onBack?: () => void;
}

export function StepGender({
  initial,
  pending,
  error,
  onSave,
  onBack,
}: StepGenderProps) {
  const [value, setValue] = useState<Gender | undefined>(initial);
  const [selecting, setSelecting] = useState<Gender | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPendingRef = useRef(pending);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // review-008 I001: if the PATCH resolved (pending true → false) and the
  // step did not unmount (failure path: error stays on this step, no
  // viewStep advance), clear `selecting` so the user can re-click without
  // being locked into the disabled state. The check uses a transition, not
  // a bare `!pending`, so the 250ms timer-only window (selecting set but
  // pending still false) doesn't prematurely reset.
  useEffect(() => {
    if (wasPendingRef.current && !pending) setSelecting(null);
    wasPendingRef.current = pending;
  }, [pending]);

  function pick(v: Gender) {
    if (pending || selecting) return;
    setValue(v);
    setSelecting(v);
    timerRef.current = setTimeout(() => {
      void onSave({ gender: v });
    }, AUTO_ADVANCE_MS);
  }

  return (
    <StepShell
      title="Tell us a bit about you"
      hint="Used only to estimate calorie needs."
      pending={pending}
      error={error}
      canContinue={false}
      autoAdvance
      onBack={onBack}
    >
      <OptionCard
        selected={value === "female"}
        selecting={selecting === "female"}
        disabled={pending || selecting !== null}
        onSelect={() => pick("female")}
        label="Female"
      />
      <OptionCard
        selected={value === "male"}
        selecting={selecting === "male"}
        disabled={pending || selecting !== null}
        onSelect={() => pick("male")}
        label="Male"
      />
    </StepShell>
  );
}
