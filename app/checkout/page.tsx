import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AMOUNT_CENTS, PAYMENT_CURRENCY } from "@/lib/payment";
import { COOKIE_NAME, findSessionById, verifyCookie } from "@/lib/session";

import { ConfirmButton } from "./ConfirmButton";

export const dynamic = "force-dynamic";

const formatPrice = (cents: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${(cents / 100).toFixed(2)}`;

/**
 * Mock payment-provider hosted-checkout page (ADR-017). Stands in for a
 * Stripe-style redirect target. Confirming here triggers the server-side
 * signed webhook — the only path that grants entitlement.
 */
export default async function CheckoutPage() {
  const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);
  if (!sid) redirect("/");

  const session = await findSessionById(sid);
  if (!session) redirect("/");
  if (session.status !== "submitted") redirect("/pay");
  if (session.entitlementStatus === "paid") redirect("/results");

  const price = formatPrice(AMOUNT_CENTS, PAYMENT_CURRENCY);

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          Mock payment provider
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">
          Confirm your payment
        </h1>
        <p className="mt-3 text-ink-700">
          You&apos;ve been redirected to a simulated payment provider. In
          production this is a hosted checkout (e.g. Stripe Checkout);
          confirming there triggers a server-verified webhook that unlocks
          your plan. No real charge is made.
        </p>

        <dl className="mt-6 flex items-baseline justify-between border-t border-ink-300/40 pt-4">
          <dt className="text-sm text-ink-500">Total</dt>
          <dd className="text-2xl font-semibold text-ink-900">{price}</dd>
        </dl>

        <ConfirmButton priceLabel={price} />

        <p className="mt-4 text-xs text-ink-500">
          Confirming signs a <code className="font-mono">checkout.completed</code>{" "}
          event server-side and posts it to{" "}
          <code className="font-mono">/api/v1/payments/webhook</code>. The
          browser never holds the signing secret, so it cannot grant access
          on its own.
        </p>
      </div>
    </main>
  );
}
