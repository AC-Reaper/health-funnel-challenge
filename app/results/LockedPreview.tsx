const ITEMS: { label: string; placeholder: string; hint: string }[] = [
  { label: "Daily calories", placeholder: "0000", hint: "kcal target" },
  { label: "Predicted target date", placeholder: "0000-00-00", hint: "based on safe weekly delta" },
  { label: "Weekly curve", placeholder: "0000", hint: "12+ data points" },
  { label: "Algorithm", placeholder: "v0.0.0", hint: "version + plan note" },
];

export function LockedPreview() {
  return (
    <section aria-label="Locked premium content preview">
      <h2 className="text-sm font-medium text-ink-700 mb-3">
        What you&apos;ll unlock
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {ITEMS.map(({ label, placeholder, hint }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-xl bg-white/70 ring-1 ring-ink-300/40 p-4"
          >
            <span
              aria-hidden
              className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-300/40 text-ink-700 text-[11px]"
            >
              🔒
            </span>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">
              {label}
            </p>
            <p
              aria-hidden
              className="mt-2 text-lg font-semibold text-ink-400 blur-[3px] select-none"
            >
              {placeholder}
            </p>
            <p className="mt-1 text-[10px] text-ink-500">{hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
