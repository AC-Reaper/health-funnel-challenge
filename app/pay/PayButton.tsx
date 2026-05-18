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

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <button
        type="button"
        onClick={handlePay}
        disabled={status === "pending"}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          background: status === "pending" ? "#94a3b8" : "#0f172a",
          color: "white",
          border: "none",
          borderRadius: 6,
          cursor: status === "pending" ? "not-allowed" : "pointer",
        }}
      >
        {status === "pending" ? "Processing…" : `Pay ${priceLabel}`}
      </button>
      {error && (
        <p
          role="alert"
          style={{ color: "#b91c1c", marginTop: "0.75rem", fontSize: "0.9rem" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
