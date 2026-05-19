import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { forwardedCookieHeader, internalUrl } from "@/lib/internal-fetch";
import {
  type FullResultDTO,
  type TeaserResultDTO,
} from "@/lib/serializers/result";
import { COOKIE_NAME, verifyCookie } from "@/lib/session";

import { PayButton } from "./PayButton";

export const dynamic = "force-dynamic";

type ResultsResponse = TeaserResultDTO | FullResultDTO;

const formatPrice = (cents: number, currency: string) =>
  `${currency === "USD" ? "$" : `${currency} `}${(cents / 100).toFixed(2)}`;

export default async function PayPage() {
  const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
  if (!sid) redirect("/");

  const res = await fetch(internalUrl("/api/v1/results/me"), {
    headers: { cookie: forwardedCookieHeader() },
    cache: "no-store",
  });

  if (res.status === 404) redirect("/");
  if (res.status === 401) redirect("/");

  if (res.status === 409) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold text-ink-900">
          Finish the quiz first
        </h1>
        <p className="mt-3 text-ink-700">
          Your account is set up, but you haven&apos;t submitted answers yet.
          Come back here once you&apos;ve completed the six steps.
        </p>
        <Link
          href="/funnel"
          className="mt-6 inline-block rounded-md bg-ink-900 px-5 py-3 text-white font-medium shadow-sm transition hover:bg-brand-700"
        >
          Continue the quiz
        </Link>
      </main>
    );
  }

  if (!res.ok) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold text-ink-900">
          Something went wrong
        </h1>
        <p className="mt-3 text-ink-700">
          Server returned {res.status}. Please try again in a moment.
        </p>
        <Link
          href="/funnel"
          className="mt-6 inline-block rounded-md bg-ink-900 px-5 py-3 text-white font-medium shadow-sm transition hover:bg-brand-700"
        >
          Back to the quiz
        </Link>
      </main>
    );
  }

  const body = (await res.json()) as ResultsResponse;
  if (body.kind === "full") redirect("/results");

  const { paywall, result } = body;
  const price = formatPrice(paywall.priceCents, paywall.currency);

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          Unlock your full plan
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink-900">
          BMI {result.bmi}{" "}
          <span className="text-ink-500 font-normal">({result.bmiCategory})</span>
        </h1>
        <p className="mt-3 text-ink-700">{result.headline}</p>

        <ul className="mt-6 space-y-2 text-sm text-ink-700">
          <li className="flex gap-2">
            <span className="text-brand-700">✓</span>{" "}
            <span><strong className="font-semibold">Daily calorie target</strong> tuned to your activity and goal</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-700">✓</span>{" "}
            <span><strong className="font-semibold">Predicted finish date</strong> at a safe weekly pace</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-700">✓</span>{" "}
            <span><strong className="font-semibold">Weekly weight curve</strong> with 12+ data points</span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-700">✓</span>{" "}
            <span>Plan summary + algorithm version on the receipt</span>
          </li>
        </ul>

        <PayButton priceLabel={price} />

        <p className="mt-4 text-xs text-ink-500">
          Mock checkout — no real charge. Pressing the button POSTs{" "}
          <code className="font-mono">/api/v1/pay</code> with an{" "}
          <code className="font-mono">Idempotency-Key</code> header.
        </p>
      </div>
    </main>
  );
}
