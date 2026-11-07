import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const shared = {
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
};

const env = {
  DATA_SOURCE: "mock",
  SESSION_SECRET: "unit-secret-unit-secret-unit-secret-00",
};

// *.test.ts run in node, *.test.tsx in jsdom; tests/integration needs a running `supabase start`
export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          env,
        },
      },
      {
        ...shared,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.tsx"],
          setupFiles: ["tests/unit/setup-dom.ts"],
          env,
        },
      },
      {
        ...shared,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Exports the local stack URL and keys (from `supabase status`) into process.env
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
