import "server-only";

import { env } from "@/lib/env";

import { createMockAccount } from "./mock/account";
import { createMockAddressLookup } from "./mock/address-lookup";
import { createMockAuth } from "./mock/auth";
import { createMockCatalog } from "./mock/catalog";
import { createMockCoupons } from "./mock/coupons";
import { createMockEngagement } from "./mock/engagement";
import { createMockNewsletter } from "./mock/newsletter";
import { createMockOrders } from "./mock/orders";
import { createMockPayments } from "./mock/payments";
import { createMockReturns } from "./mock/returns";
import { createMockShipping } from "./mock/shipping";
import type { Ports } from "./ports";

let ports: Ports | undefined;

export function getData(): Ports {
  if (env.DATA_SOURCE !== "mock") {
    throw new Error('Unsupported DATA_SOURCE (only "mock" is implemented)');
  }
  ports ??= {
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
  };
  return ports;
}
