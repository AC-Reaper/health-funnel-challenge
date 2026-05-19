import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { forwardedCookieHeader, internalUrl } from "@/lib/internal-fetch";
import {
  type FullResultDTO,
  type TeaserResultDTO,
} from "@/lib/serializers/result";
import { COOKIE_NAME, verifyCookie } from "@/lib/session";

import { LockedPreview } from "./LockedPreview";

export const dynamic = "force-dynamic";

type ResultsResponse = TeaserResultDTO | FullResultDTO;

async function fetchResults(): Promise<
  { ok: true; data: ResultsResponse } | { ok: false; status: number; code?: string }
> {
  const res = await fetch(internalUrl("/api/v1/results/me"), {
    headers: { cookie: forwardedCookieHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { code?: string };
    };
    return { ok: false, status: res.status, code: body.error?.code };
  }
  return { ok: true, data: (await res.json()) as ResultsResponse };
}

export default async function ResultsPage() {
  const sid = verifyCookie(cookies().get(COOKIE_NAME)?.value);
  if (!sid) redirect("/");

  const response = await fetchResults();

  if (!response.ok) {
    if (response.status === 404) redirect("/");

    const isNotSubmitted = response.code === "NOT_SUBMITTED";
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold text-ink-900">
          {isNotSubmitted ? "Finish the quiz first" : "Results unavailable"}
        </h1>
        <p className="mt-3 text-ink-700">
          {isNotSubmitted
            ? "Submit your answers before viewing the plan."
            : `Server returned ${response.status}.`}
        </p>
        <Link
          href={isNotSubmitted ? "/funnel" : "/"}
          className="mt-6 inline-block rounded-md bg-ink-900 px-5 py-3 text-white font-medium shadow-sm transition hover:bg-brand-700"
        >
          {isNotSubmitted ? "Continue the quiz" : "Back home"}
        </Link>
      </main>
    );
  }

  const { data } = response;

  if (data.kind === "teaser") {
    const priceLabel = (data.paywall.priceCents / 100).toFixed(2);
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
            Your starting point
          </p>
          <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">
            BMI {data.result.bmi}{" "}
            <span className="text-ink-500 font-normal text-2xl">
              ({data.result.bmiCategory})
            </span>
          </h1>
        </header>

        <section className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8">
          <p className="text-ink-700">{data.result.headline}</p>
          <Link
            href={data.paywall.ctaHref}
            className="mt-6 inline-flex w-full sm:w-auto items-center justify-center rounded-md bg-ink-900 px-6 py-3 text-white font-semibold shadow-sm transition hover:bg-brand-700"
          >
            Unlock for {priceLabel} {data.paywall.currency}
          </Link>
        </section>

        <LockedPreview />
      </main>
    );
  }

  // Full result — report-style layout.
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-16 space-y-6">
      <header className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-700">
          Your plan
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">
            BMI {data.result.bmi}
          </h1>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-500/30">
            {data.result.bmiCategory}
          </span>
          <span className="text-xs text-ink-500">
            {data.result.algorithmVersion}
          </span>
        </div>
      </header>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8">
        <p className="text-sm text-ink-500">Daily calorie target</p>
        <p className="mt-1 text-3xl font-semibold text-ink-900">
          {data.result.dailyCaloriesKcal}{" "}
          <span className="text-base font-normal text-ink-500">kcal</span>
        </p>
        {data.result.predictedTargetDate ? (
          <p className="mt-4 text-ink-700">
            Predicted finish date:{" "}
            <strong className="text-ink-900">
              {data.result.predictedTargetDate}
            </strong>
          </p>
        ) : (
          <p className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Your goal sits outside our safe planning range — consider
            consulting a healthcare professional.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8">
        <p className="text-ink-700">{data.result.plan.summary}</p>
        {data.result.plan.note === "consult_professional" ? (
          <p className="mt-3 text-sm text-amber-800">
            Note: please consult a healthcare professional.
          </p>
        ) : null}
      </section>

      <details className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-300/40 p-6 sm:p-8 group">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">
          Weekly curve ({data.result.curvePoints.length} points)
        </summary>
        <pre className="mt-3 overflow-x-auto text-xs text-ink-700 bg-slate-50 p-3 rounded">
          {JSON.stringify(data.result.curvePoints, null, 2)}
        </pre>
      </details>

      <p className="mt-6 text-xs text-ink-500">
        Simulated result based on your inputs. No real charge was made
        — this is a 5-day interview demo.
      </p>
    </main>
  );
}
