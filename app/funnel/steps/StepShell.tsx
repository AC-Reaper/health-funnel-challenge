"use client";

import type { ReactNode } from "react";

interface StepShellProps {
  title: string;
  hint?: string;
  error?: string | null;
  pending: boolean;
  canContinue: boolean;
  onContinue: () => void;
  continueLabel?: string;
  children: ReactNode;
}

export function StepShell({
  title,
  hint,
  error,
  pending,
  canContinue,
  onContinue,
  continueLabel = "Continue",
  children,
}: StepShellProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && canContinue) onContinue();
      }}
      className="space-y-6"
    >
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

      <button
        type="submit"
        disabled={pending || !canContinue}
        className="w-full rounded-md bg-ink-900 px-4 py-3 text-white font-medium text-base shadow-sm transition hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
      >
        {pending ? "Saving…" : continueLabel}
      </button>
    </form>
  );
}

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  description?: string;
}

export function OptionCard({
  selected,
  onSelect,
  label,
  description,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "w-full text-left rounded-lg border px-4 py-3 transition " +
        (selected
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30"
          : "border-ink-300 bg-white hover:border-brand-500/60")
      }
    >
      <div className="font-medium text-ink-900">{label}</div>
      {description ? (
        <div className="text-xs text-ink-500 mt-0.5">{description}</div>
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
