import { StartFunnelButton } from "./StartFunnelButton";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
      <p className="text-sm font-medium uppercase tracking-wider text-brand-700">
        Health Funnel Challenge
      </p>
      <h1 className="mt-2 text-4xl font-bold text-ink-900 sm:text-5xl">
        Build a sustainable plan in 6 quick steps.
      </h1>
      <p className="mt-4 text-lg text-ink-700">
        Answer a short quiz and we&apos;ll project a safe weekly curve, a daily
        calorie target, and a realistic finish date. Anonymous and free to start.
      </p>

      <div className="mt-8">
        <StartFunnelButton />
      </div>

      <p className="mt-6 text-xs text-ink-500">
        No account needed. We use an HMAC-signed session cookie so you can
        resume mid-funnel after a refresh.
      </p>
    </main>
  );
}
