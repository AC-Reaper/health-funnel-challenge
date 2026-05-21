"use client";

import { useState } from "react";

import { confirmMockPayment } from "./actions";

interface ConfirmButtonProps {
  priceLabel: string;
}

export function ConfirmButton({ priceLabel }: ConfirmButtonProps) {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("pending");
    setError(null);
    try {
      const result = await confirmMockPayment();
      if (!result.ok) throw new Error(result.error);
      window.location.href = "/results";
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Payment failed.");
    }
  }

  const isPending = status === "pending";
  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-ink-900 px-5 py-3 text-white font-semibold text-base shadow-sm transition hover:bg-brand-700 disabled:bg-ink-300 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
            Processing…
          </>
        ) : (
          <>Confirm payment {priceLabel}</>
        )}
      </button>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
