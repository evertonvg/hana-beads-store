import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Anonymous client: publishable key, no cookies, no session.
 * The only client allowed inside `'use cache'`.
 */
export function createSupabasePublicClient(): SupabaseClient<Database> {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
