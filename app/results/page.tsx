import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  type FullResultDTO,
  type TeaserResultDTO,
} from "@/lib/serializers/result";
import { COOKIE_NAME, verifyCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

type ResultsResponse = TeaserResultDTO | FullResultDTO;

async function fetchResults(): Promise<
  { ok: true; data: ResultsResponse } | { ok: false; status: number; code?: string }
> {
  const host = headers().get("host");
  const protocol =
    headers().get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${protocol}://${host}/api/v1/results/me`, {
    headers: { cookie: cookieHeader },
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
    return (
      <main style={{ maxWidth: 480, margin: "10vh auto", padding: "0 1.5rem" }}>
        <h1>Results unavailable</h1>
        <p style={{ color: "#444" }}>
          {response.code === "NOT_SUBMITTED"
            ? "Finish the funnel and submit before viewing results."
            : `Server returned ${response.status}.`}
        </p>
        <p>
          <a href="/">Back home</a>
        </p>
      </main>
    );
  }

  const { data } = response;

  return (
    <main style={{ maxWidth: 640, margin: "8vh auto", padding: "0 1.5rem" }}>
      <p
        style={{
          color: "#92400e",
          background: "#fffbeb",
          padding: "0.5rem 0.75rem",
          borderRadius: 6,
          fontSize: "0.875rem",
          marginBottom: "1rem",
        }}
      >
        Day-3 placeholder. The polished funnel + results UI ships on
        Day 4 (T-401).
      </p>

      <h1 style={{ fontSize: "1.75rem" }}>
        Your starting point: BMI {data.result.bmi} ({data.result.bmiCategory})
      </h1>

      {data.kind === "teaser" ? (
        <section>
          <p style={{ color: "#444" }}>{data.result.headline}</p>
          <a
            href={data.paywall.ctaHref}
            style={{
              display: "inline-block",
              marginTop: "1rem",
              padding: "0.75rem 1.5rem",
              background: "#0f172a",
              color: "white",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Unlock for {(data.paywall.priceCents / 100).toFixed(2)}{" "}
            {data.paywall.currency}
          </a>
        </section>
      ) : (
        <section>
          <p>
            Daily target: <strong>{data.result.dailyCaloriesKcal} kcal</strong>
          </p>
          {data.result.predictedTargetDate ? (
            <p>
              Predicted target date:{" "}
              <strong>{data.result.predictedTargetDate}</strong>
            </p>
          ) : (
            <p style={{ color: "#92400e" }}>
              Your goal is outside the safe planning range — consider
              consulting a professional.
            </p>
          )}
          <details>
            <summary>Weekly curve ({data.result.curvePoints.length} points)</summary>
            <pre style={{ fontSize: "0.85rem" }}>
              {JSON.stringify(data.result.curvePoints, null, 2)}
            </pre>
          </details>
          <p style={{ color: "#444" }}>{data.result.plan.summary}</p>
          {data.result.plan.note === "consult_professional" && (
            <p style={{ color: "#92400e" }}>
              Note: please consult a healthcare professional.
            </p>
          )}
          <p style={{ color: "#888", fontSize: "0.8rem" }}>
            Algorithm version: {data.result.algorithmVersion}
          </p>
        </section>
      )}
    </main>
  );
}
