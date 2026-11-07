import type { SupabaseClient } from "@supabase/supabase-js";

import type { NewsletterPort } from "@/lib/data/ports";
import type { Database } from "@/lib/supabase/database.types";

import { toPortError } from "./errors";

export function createSupabaseNewsletter(deps: {
  getClient: () => Promise<SupabaseClient<Database>>;
}): NewsletterPort {
  return {
    async subscribe({ email, consentVersion }) {
      const c = await deps.getClient();
      const { data, error } = await c.rpc("subscribe_newsletter", {
        p_email: email,
        p_consent_version: consentVersion,
      });
      if (error) toPortError(error);
      return { status: data === "ok" ? "ok" : "already" };
    },
  };
}
