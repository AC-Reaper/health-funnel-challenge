"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartFunnelButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      router.push("/funnel");
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Could not start session.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleStart}
        disabled={pending}
        className="rounded-md bg-ink-900 px-6 py-3 text-white font-medium text-base shadow-sm transition hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
      >
        {pending ? "Starting…" : "Start the quiz"}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
