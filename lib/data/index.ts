import "server-only";

import { getClientIp } from "@/lib/client-ip";
import { env, publicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseAuthClient } from "@/lib/supabase/auth-client";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createMockAccount } from "./mock/account";
import { createMockAddressLookup } from "./mock/address-lookup";
import { createMockAuth } from "./mock/auth";
import { createMockCatalog } from "./mock/catalog";
import { createMockCoupons } from "./mock/coupons";
import { createMockEngagement } from "./mock/engagement";
import { createMockNewsletter } from "./mock/newsletter";
import { createMockOrders } from "./mock/orders";
import { createMockPayments } from "./mock/payments";
import { createMockRateLimit } from "./mock/rate-limit";
import { createMockReturns } from "./mock/returns";
import { createMockShipping } from "./mock/shipping";
import type { Ports } from "./ports";
import { createSupabaseAccountReads } from "./supabase/account-reads";
import { createSupabaseAuth } from "./supabase/auth";
import { createCachedSupabaseCatalog } from "./supabase/catalog";
import { createSupabaseEngagement } from "./supabase/engagement";
import { createSupabaseNewsletter } from "./supabase/newsletter";
import { createSupabaseRateLimit } from "./supabase/rate-limit";
import { createViaCepLookup } from "./viacep";

let ports: Ports | undefined;

/** Mock-only ports in both modes; client factories below run per request, inside the methods. */
function buildMock(): Ports {
  return {
    catalog: createMockCatalog(),
    newsletter: createMockNewsletter(),
    engagement: createMockEngagement(),
    shipping: createMockShipping(),
    coupons: createMockCoupons(),
    auth: createMockAuth(),
    account: createMockAccount(),
    addressLookup: createMockAddressLookup(),
    orders: createMockOrders(),
    payments: createMockPayments(),
    returns: createMockReturns(),
    rateLimit: createMockRateLimit(),
  };
}

function buildSupabase(): Ports {
  return {
    ...buildMock(),
    catalog: createCachedSupabaseCatalog(),
    auth: createSupabaseAuth({
      getClient: createSupabaseServerClient,
      getAuthClient: async () => createSupabaseAuthClient(await getClientIp()),
      getAdminClient: createSupabaseAdminClient,
      siteUrl: publicEnv.siteUrl,
    }),
    engagement: createSupabaseEngagement({ getClient: createSupabaseServerClient }),
    newsletter: createSupabaseNewsletter({
      getClient: () => Promise.resolve(createSupabasePublicClient()),
    }),
    rateLimit: createSupabaseRateLimit({ getAdmin: createSupabaseAdminClient }),
    addressLookup: createViaCepLookup(),
    account: createSupabaseAccountReads({ getClient: createSupabaseServerClient }),
  };
}

export function getData(): Ports {
  ports ??= env.DATA_SOURCE === "supabase" ? buildSupabase() : buildMock();
  return ports;
}
