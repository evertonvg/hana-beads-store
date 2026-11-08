import { execSync } from "node:child_process";

export type LocalSupabaseEnv = { apiUrl: string; publishableKey: string; secretKey: string };

/**
 * Reads the URL and keys of the running local Supabase stack (`supabase start`) so no secret is
 * committed. Works the same on a dev machine and in CI. Shared with `playwright.supabase.config.ts`.
 */
export function readLocalSupabaseEnv(): LocalSupabaseEnv {
  const out = execSync("npx supabase status -o env", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const values = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  for (const key of ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"]) {
    if (!values[key])
      throw new Error(`supabase status did not print ${key}; is the stack running?`);
  }
  return {
    apiUrl: values.API_URL,
    publishableKey: values.PUBLISHABLE_KEY,
    secretKey: values.SECRET_KEY,
  };
}

export default function setup() {
  const local = readLocalSupabaseEnv();
  process.env.DATA_SOURCE = "supabase";
  process.env.NEXT_PUBLIC_SUPABASE_URL = local.apiUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = local.publishableKey;
  process.env.SUPABASE_SECRET_KEY = local.secretKey;
  process.env.REVALIDATE_SECRET = "integration-revalidate-secret-0000";
}
