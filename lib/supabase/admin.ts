import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/** Secret-key client: bypasses RLS. Server-only; never pass user input straight into queries. */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
