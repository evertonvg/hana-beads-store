/** Test-only value (32+ characters): the server runs with it and specs call /api/revalidate with it. */
export const E2E_REVALIDATE_SECRET = "e2e-revalidate-secret-e2e-revalidate";

/** URL and secret key of the local stack, exported by `playwright.supabase.config.ts`. */
export function localSupabase(): { url: string; secretKey: string } {
  const url = process.env.E2E_SUPABASE_URL;
  const secretKey = process.env.E2E_SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("run through playwright.supabase.config.ts");
  return { url, secretKey };
}
