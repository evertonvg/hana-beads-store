import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";
import { applyRememberPolicy, isRemembered } from "./remember";

/** Cookie-bound client (publishable key) for Server Components and Server Actions. */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const remember = isRemembered(cookieStore);
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, applyRememberPolicy(options, remember));
            }
          } catch {
            // Server Component: cookies are read-only here; the proxy persists the refreshed session.
          }
        },
      },
    },
  );
}
