import { execSync } from "node:child_process";

import { clearInbox } from "./mailpit";

/**
 * Fresh state for every run: `supabase db reset` re-applies the migrations and the seed (9
 * products, Ana, the admin) and empties `rate_limits`; Mailpit starts empty. Needs `supabase start`.
 */
export default async function globalSetup() {
  execSync("npx supabase db reset", { stdio: "inherit" });
  await clearInbox();
}
