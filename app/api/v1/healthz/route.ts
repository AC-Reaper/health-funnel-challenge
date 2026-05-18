import { NextResponse } from "next/server";

import { getRequestId } from "@/lib/api/request-id";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const requestId = getRequestId(req);
  return NextResponse.json(
    { status: "ok", version: "v1", ts: new Date().toISOString() },
    { headers: { "x-request-id": requestId } },
  );
}
