import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@/lib": fileURLToPath(new URL("./lib", import.meta.url)),
      "@/app": fileURLToPath(new URL("./app", import.meta.url)),
      // Next aliases `server-only` to a no-op at build time; outside
      // Next the real package throws. Tests only exercise pure functions
      // from server-only modules, so swap in an empty shim.
      "server-only": fileURLToPath(
        new URL("./tests/_shims/server-only.ts", import.meta.url),
      ),
    },
  },
});
