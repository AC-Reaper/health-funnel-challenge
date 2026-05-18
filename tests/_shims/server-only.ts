// Vitest shim. Next.js aliases `server-only` to a no-op at build time;
// outside Next (i.e. in a Node test runner), the real package throws.
// Tests target pure functions from server-only modules, so silencing
// the guard is the right move.
export {};
