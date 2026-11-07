import type { SupabaseClient } from "@supabase/supabase-js";

import type { EngagementPort } from "@/lib/data/ports";
import type { Database } from "@/lib/supabase/database.types";

import { toPortError } from "./errors";

type Client = SupabaseClient<Database>;

/** Favorites (RLS, signed-in user only) and stock alerts (RPC, visitors allowed). */
export function createSupabaseEngagement(deps: {
  getClient: () => Promise<Client>;
}): EngagementPort {
  /** The caller's `userId` must be the session's user: RLS would otherwise act for someone else. */
  async function client(userId: string | null): Promise<Client> {
    const c = await deps.getClient();
    if (userId !== null) {
      const { data, error } = await c.auth.getUser();
      if (error || data.user?.id !== userId) throw new Error("session mismatch");
    }
    return c;
  }

  return {
    async toggleFavorite(userId, productId) {
      const c = await client(userId);
      const { data, error } = await c.rpc("toggle_favorite", { p_product_id: productId });
      if (error) toPortError(error);
      return data;
    },

    async favorites(userId) {
      const c = await client(userId);
      const { data, error } = await c
        .from("favorites")
        .select("product_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (error) toPortError(error);
      return data.map((r) => r.product_id);
    },

    async requestStockAlert({ userId, email, productId, consentedAt }) {
      const c = await client(userId);
      const { error } = await c.rpc("request_stock_alert", {
        p_email: email,
        p_product_id: productId,
        p_consented_at: consentedAt,
      });
      if (error) toPortError(error);
    },
  };
}
