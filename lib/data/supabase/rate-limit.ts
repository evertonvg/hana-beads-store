import type { SupabaseClient } from "@supabase/supabase-js";

import type { RateLimitPort } from "@/lib/data/ports";
import type { Database } from "@/lib/supabase/database.types";

import { toPortError } from "./errors";

/** Fixed-window counters in Postgres; `rate_limit_hit` is executable by the secret key only. */
export function createSupabaseRateLimit(deps: {
  getAdmin: () => SupabaseClient<Database>;
}): RateLimitPort {
  return {
    async hit(key, max, windowSeconds) {
      const { data, error } = await deps.getAdmin().rpc("rate_limit_hit", {
        p_key: key,
        p_max: max,
        p_window_seconds: windowSeconds,
      });
      if (error) toPortError(error);
      return data;
    },
  };
}
