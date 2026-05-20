// Vitest setup. Runs once before each test file. Provides safe placeholder
// env values so `lib/env.ts` parses without a real Supabase project.
// Tests that need real DB connectivity are integration tests and don't
// live in this suite (see the cURL matrix in T-202 commits).

process.env.DATABASE_URL ??=
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";
process.env.DIRECT_URL ??=
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";
process.env.SESSION_COOKIE_SECRET ??=
  "test-secret-test-secret-test-secret-test-secret";
process.env.PAYMENT_WEBHOOK_SECRET ??=
  "test-webhook-secret-test-webhook-secret-test-webhook";
// NODE_ENV is read-only under @types/node; vitest already sets it to "test".
