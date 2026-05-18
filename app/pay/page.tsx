import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_NAME, verifyCookie } from "@/lib/session";
import { CTA_HREF, CURRENCY, PRICE_CENTS } from "@/lib/serializers/result";

import { PayButton } from "./PayButton";

export const dynamic = "force-dynamic";

const formatPrice = (cents: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${(cents / 100).toFixed(2)}`;

export default function PayPage() {
  const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
  if (!sid) redirect("/");

  return (
    <main style={{ maxWidth: 480, margin: "10vh auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
        Unlock your full plan
      </h1>
      <p style={{ color: "#444", lineHeight: 1.5 }}>
        Day-3 mock payment. {formatPrice(PRICE_CENTS, CURRENCY)} unlocks your
        full results — daily calories, weekly curve, and a target date.
      </p>
      <p style={{ color: "#888", fontSize: "0.875rem", marginTop: "1rem" }}>
        No real charge. The button calls{" "}
        <code>POST {CTA_HREF.replace("/pay", "/api/v1/pay")}</code> with an{" "}
        <code>Idempotency-Key</code> header.
      </p>
      <PayButton priceLabel={formatPrice(PRICE_CENTS, CURRENCY)} />
    </main>
  );
}
