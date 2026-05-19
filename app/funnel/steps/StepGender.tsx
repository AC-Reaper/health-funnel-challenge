"use client";

import { useState } from "react";

import type { SessionAnswersDTO } from "@/lib/session";

import { OptionCard, StepShell } from "./StepShell";

type Gender = NonNullable<SessionAnswersDTO["gender"]>;

interface StepGenderProps {
  initial: Gender | undefined;
  pending: boolean;
  error: string | null;
  onSave: (body: { gender: Gender }) => Promise<void>;
}

export function StepGender({ initial, pending, error, onSave }: StepGenderProps) {
  const [value, setValue] = useState<Gender | undefined>(initial);

  return (
    <StepShell
      title="Tell us a bit about you"
      hint="Used only to estimate calorie needs."
      pending={pending}
      error={error}
      canContinue={value !== undefined}
      onContinue={() => value && onSave({ gender: value })}
    >
      <OptionCard
        selected={value === "female"}
        onSelect={() => setValue("female")}
        label="Female"
      />
      <OptionCard
        selected={value === "male"}
        onSelect={() => setValue("male")}
        label="Male"
      />
    </StepShell>
  );
}
