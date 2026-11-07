import { execSync } from "node:child_process";

/**
 * Reads the keys of the running local Supabase stack (`supabase start`) so no secret is committed.
 * Works the same on a dev machine and in CI.
 */
export default function setup() {
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
  process.env.DATA_SOURCE = "supabase";
  process.env.NEXT_PUBLIC_SUPABASE_URL = values.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = values.PUBLISHABLE_KEY;
  process.env.SUPABASE_SECRET_KEY = values.SECRET_KEY;
  process.env.REVALIDATE_SECRET = "integration-revalidate-secret-0000";
}
