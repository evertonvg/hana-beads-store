import type { OrdersPort } from "@/lib/data/ports";
import type { Order } from "@/lib/data/types";

import { getMockStore } from "./store";

/** One after the highest number in use, so the fixture orders (#0001 to #0005) are never reused. */
const nextNumber = (orders: Order[]) =>
  String(Math.max(0, ...orders.map((o) => Number(o.number))) + 1).padStart(4, "0");

/** In-memory orders. `create` is synchronous inside, so the key check and the insert never interleave. */
export function createMockOrders(): OrdersPort {
  return {
    create(input, idempotencyKey) {
      const store = getMockStore();
      const existingId = store.orderKeys[idempotencyKey];
      const existing = existingId ? store.orders.find((o) => o.id === existingId) : undefined;
      if (existing) return Promise.resolve(structuredClone(existing));

      const at = new Date().toISOString();
      const order: Order = {
        id: `ord_${crypto.randomUUID()}`,
        number: nextNumber(store.orders),
        userId: input.userId,
        guestToken: input.guestToken,
        status: "aguardando_pagamento",
        paymentMethod: input.paymentMethod,
        items: input.items,
        subtotalCents: input.subtotalCents,
        shippingCents: input.shippingCents,
        discountCents: input.discountCents,
        totalCents: input.totalCents,
        shippingAddress: input.shippingAddress,
        customer: input.customer,
        shippingService: input.shippingService,
        trackingCode: null,
        isCustom: false,
        createdAt: at,
        events: [{ status: "aguardando_pagamento", at }],
        payment: null,
      };
      store.orders.unshift(order);
      store.orderKeys[idempotencyKey] = order.id;
      return Promise.resolve(structuredClone(order));
    },

    get(id, viewer) {
      const order = getMockStore().orders.find((o) => o.id === id);
      const owns =
        order !== undefined &&
        ((order.userId !== null && order.userId === viewer.userId) ||
          (order.guestToken !== null && viewer.guestTokens.includes(order.guestToken)));
      return Promise.resolve(owns ? structuredClone(order) : null);
    },

    listForUser(userId) {
      const mine = getMockStore()
        .orders.filter((o) => o.userId === userId)
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
      return Promise.resolve(structuredClone(mine));
    },

    setStatus(id, status) {
      const order = getMockStore().orders.find((o) => o.id === id);
      if (order) {
        order.status = status;
        order.events.push({ status, at: new Date().toISOString() });
      }
      return Promise.resolve();
    },
  };
}
