import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  COOKIE_NAME,
  findAssessmentBySessionId,
  findSessionById,
  serializeSession,
  verifyCookie,
} from "@/lib/session";

import { FunnelStepper } from "./FunnelStepper";

export const dynamic = "force-dynamic";

export default async function FunnelPage() {
  const sid = verifyCookie((await cookies()).get(COOKIE_NAME)?.value);
  if (!sid) redirect("/");

  const session = await findSessionById(sid);
  if (!session) redirect("/");

  if (session.status === "submitted") redirect("/results");

  const assessment = await findAssessmentBySessionId(sid);
  const bootstrap = serializeSession(session, assessment);

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <FunnelStepper bootstrap={bootstrap} />
    </main>
  );
}
