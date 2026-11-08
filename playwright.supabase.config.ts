import { defineConfig, devices } from "@playwright/test";

import { E2E_REVALIDATE_SECRET } from "./tests/e2e-supabase/support/env";
import { readLocalSupabaseEnv } from "./tests/integration/global-setup";

/**
 * E2E against the local Supabase stack (`npm run db:start` first). The global setup resets the
 * database (seed, rate-limit counters) and empties Mailpit before the specs run.
 */
const PORT = 3200;
const SITE_URL = `http://localhost:${PORT}`;

// The config is evaluated again in each worker: read `supabase status` once, workers inherit it.
if (!process.env.E2E_SUPABASE_URL) {
  const local = readLocalSupabaseEnv();
  process.env.E2E_SUPABASE_URL = local.apiUrl;
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = local.publishableKey;
  process.env.E2E_SUPABASE_SECRET_KEY = local.secretKey;
}

export default defineConfig({
  testDir: "tests/e2e-supabase",
  globalSetup: "./tests/e2e-supabase/support/global-setup.ts",
  // One database and one inbox shared by every spec: run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: SITE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: SITE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      DATA_SOURCE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.E2E_SUPABASE_PUBLISHABLE_KEY!,
      SUPABASE_SECRET_KEY: process.env.E2E_SUPABASE_SECRET_KEY!,
      REVALIDATE_SECRET: E2E_REVALIDATE_SECRET,
      // Specs send their own x-forwarded-for, so each test gets fresh per-IP rate-limit counters.
      CLIENT_IP_HEADER: "x-forwarded-for",
      // The e-mail links (emailRedirectTo) must come back to this server.
      NEXT_PUBLIC_SITE_URL: SITE_URL,
      NEXT_PUBLIC_INSTAGRAM_USER: "pixelperfect.teste",
    },
  },
});
