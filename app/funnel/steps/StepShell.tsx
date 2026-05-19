"use client";

import type { ReactNode } from "react";

interface StepShellProps {
  title: string;
  hint?: string;
  error?: string | null;
  pending: boolean;
  canContinue: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  continueLabel?: string;
  autoAdvance?: boolean;
  children: ReactNode;
}

export function StepShell({
  title,
  hint,
  error,
  pending,
  canContinue,
  onContinue,
  onBack,
  continueLabel = "Continue",
  autoAdvance = false,
  children,
}: StepShellProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!autoAdvance && onContinue && !pending && canContinue) onContinue();
      }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between min-h-[1.5rem]">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={pending}
            className="text-sm text-ink-500 hover:text-ink-900 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
      </div>

      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-ink-900">{title}</h2>
        {hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
      </header>

      <div className="space-y-3">{children}</div>

      {error ? (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {error}
        </p>
      ) : null}

      {autoAdvance ? null : (
        <button
          type="submit"
          disabled={pending || !canContinue}
          className="w-full rounded-md bg-ink-900 px-4 py-3 text-white font-medium text-base shadow-sm transition hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : continueLabel}
        </button>
      )}
    </form>
  );
}

interface OptionCardProps {
  selected: boolean;
  selecting?: boolean;
  disabled?: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
}

export function OptionCard({
  selected,
  selecting = false,
  disabled = false,
  onSelect,
  label,
  description,
}: OptionCardProps) {
  const active = selected || selecting;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={
        "relative w-full text-left rounded-lg px-4 py-3 transition disabled:cursor-not-allowed " +
        (active
          ? "border-2 border-brand-500 bg-brand-50 shadow-sm"
          : "border-2 border-ink-300 bg-white hover:border-brand-500/60 hover:bg-brand-50/40")
      }
    >
      <div className={(active ? "font-semibold " : "font-medium ") + "text-ink-900"}>
        {label}
      </div>
      {description ? (
        <div className="text-xs text-ink-500 mt-0.5">{description}</div>
      ) : null}
      {active ? (
        <span
          aria-hidden
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white text-xs font-bold shadow"
        >
          ✓
        </span>
      ) : null}
    </button>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | "";
  onChange: (v: number | "") => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  error?: string;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  error,
}: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
        {unit ? <span className="text-ink-500 font-normal"> ({unit})</span> : null}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step ?? 1}
        value={value === "" ? "" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onChange("");
          else {
            const n = Number(v);
            onChange(Number.isFinite(n) ? n : "");
          }
        }}
        className={
          "w-full rounded-md border bg-white px-3 py-2 text-base text-ink-900 outline-none transition focus:ring-2 focus:ring-brand-500/40 " +
          (error ? "border-red-400" : "border-ink-300 focus:border-brand-500")
        }
      />
      {error ? (
        <p className="text-xs text-red-700">{error}</p>
      ) : (
        <p className="text-xs text-ink-500">
          {min}–{max}
          {unit ? ` ${unit}` : ""}
        </p>
      )}
    </div>
  );
}
