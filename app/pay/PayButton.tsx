"use client";

import { useState } from "react";

interface PayButtonProps {
  priceLabel: string;
}

export function PayButton({ priceLabel }: PayButtonProps) {
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setStatus("pending");
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch("/api/v1/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: "{}",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = (await res.json()) as {
          error?: { code?: string; message?: string };
        };
        throw new Error(
          body.error?.message ?? `Payment failed (${res.status})`,
        );
      }
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
        onClick={handlePay}
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
          <>Pay {priceLabel}</>
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
