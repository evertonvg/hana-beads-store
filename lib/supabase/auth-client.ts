import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./database.types";
import { applyRememberPolicy, REMEMBER_COOKIE } from "./remember";

/**
 * Client for rate-limited `supabase.auth.*` calls only (signIn, signUp, resend, resetPasswordForEmail).
 * It uses the secret key so Supabase Auth honours `sb-forwarded-for` (the end user's IP).
 * NEVER use it for PostgREST/data queries: with the secret key they would bypass RLS.
 */
export async function createSupabaseAuthClient(
  clientIp: string | null,
): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const remember = cookieStore.has(REMEMBER_COOKIE);
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
    global: { headers: clientIp ? { "sb-forwarded-for": clientIp } : {} },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, applyRememberPolicy(options, remember));
          }
        } catch {
          // Server Component: the proxy persists the refreshed session.
        }
      },
    },
  });
}
