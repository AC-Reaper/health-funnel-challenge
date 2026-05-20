import Link from "next/link";
import { cookies } from "next/headers";

import { type LandingCta, resolveLandingCta } from "@/lib/landing-cta";
import {
  COOKIE_NAME,
  findAssessmentBySessionId,
  findSessionById,
  serializeSession,
  verifyCookie,
} from "@/lib/session";

import { StartFunnelButton } from "./StartFunnelButton";

export const dynamic = "force-dynamic";

async function resolveCta(): Promise<LandingCta> {
  const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);
  if (!sid) return "start";

  const session = await findSessionById(sid);
  if (!session) return "start";

  const assessment =
    session.status === "draft" ? await findAssessmentBySessionId(sid) : null;
  const hasAnswers =
    Object.keys(serializeSession(session, assessment).answers).length > 0;

  return resolveLandingCta(session, hasAnswers);
}

const LINK_CLASSES =
  "inline-block rounded-md bg-ink-900 px-6 py-3 text-white font-medium text-base shadow-sm transition hover:bg-brand-700";

const COPY: Record<
  LandingCta,
  { heading: string; lead: string; note: string }
> = {
  start: {
    heading: "Build a sustainable plan in 6 quick steps.",
    lead: "Answer a short quiz and we'll project a safe weekly curve, a daily calorie target, and a realistic finish date. Anonymous and free to start.",
    note: "No account needed. We use an HMAC-signed session cookie so you can resume mid-funnel after a refresh.",
  },
  continue: {
    heading: "Welcome back — pick up where you left off.",
    lead: "Your answers are saved against an anonymous session cookie. Continue the quiz to finish the remaining steps and see your plan.",
    note: "We use an HMAC-signed session cookie, so your progress survives a refresh.",
  },
  results: {
    heading: "Your plan is ready.",
    lead: "You've already completed the quiz on this device. Jump straight to your results — no need to start over.",
    note: "Results are tied to your anonymous session cookie on this browser.",
  },
};

export default async function HomePage() {
  const cta = await resolveCta();
  const copy = COPY[cta];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
        Health Funnel Challenge
      </p>
      <h1 className="mt-2 text-4xl font-bold text-ink-900 sm:text-5xl">
        {copy.heading}
      </h1>
      <p className="mt-4 text-lg text-ink-700">{copy.lead}</p>

      <div className="mt-8">
        {cta === "start" ? (
          <StartFunnelButton />
        ) : cta === "continue" ? (
          <Link href="/funnel" className={LINK_CLASSES}>
            Continue the quiz
          </Link>
        ) : (
          <Link href="/results" className={LINK_CLASSES}>
            View your results
          </Link>
        )}
      </div>

      <p className="mt-6 text-xs text-ink-500">{copy.note}</p>
    </main>
  );
}
