import "server-only";

import { PrismaClient } from "@prisma/client";

import { env } from "./env";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__prismaClient ??
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prismaClient = db;
}
