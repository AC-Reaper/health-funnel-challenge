"use client";

import type { StepKey } from "@prisma/client";

import { STEP_ORDER } from "@/lib/progress";

interface ProgressBarProps {
  viewStep: StepKey;
  submitted: boolean;
}

const STEP_LABELS: Record<StepKey, string> = {
  gender: "About you",
  main_goal: "Your goal",
  age: "Age",
  height: "Height",
  weight: "Weight",
  activity: "Activity",
};

export function ProgressBar({ viewStep, submitted }: ProgressBarProps) {
  const total = STEP_ORDER.length;
  const idx = STEP_ORDER.indexOf(viewStep);
  const displayIndex = submitted ? total : idx + 1;
  const pct = Math.round((displayIndex / total) * 100);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-ink-500 mb-2">
        <span>
          Step {displayIndex} of {total}
        </span>
        <span>{submitted ? "Done" : STEP_LABELS[viewStep]}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 w-full rounded-full bg-ink-300/40 overflow-hidden"
      >
        <div
          className="h-full bg-brand-500 transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="mt-3 flex gap-1 text-[10px] text-ink-500">
        {STEP_ORDER.map((s, i) => {
          const isPast = submitted || i < idx;
          const isCurrent = !submitted && i === idx;
          return (
            <li
              key={s}
              className={
                "flex-1 text-center truncate " +
                (isPast
                  ? "text-brand-700 font-medium"
                  : isCurrent
                    ? "text-ink-900 font-medium"
                    : "")
              }
              title={STEP_LABELS[s]}
            >
              {isPast ? "✓ " : ""}
              {STEP_LABELS[s]}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
