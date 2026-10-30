import { beforeEach, describe, expect, it } from "vitest";
import { createMockOrders } from "@/lib/data/mock/orders";
import { getMockStore } from "@/lib/data/mock/store";
import { placedOrders } from "./placed-orders";
import type { CreateOrderInput } from "@/lib/data/ports";

const input = (over: Partial<CreateOrderInput> = {}): CreateOrderInput => ({
  userId: null,
  guestToken: "guest-1",
  paymentMethod: "pix",
  items: [
    {
      productId: "garota",
      name: "GAROTA PIXEL",
      ring: "mosquetao",
      unitPriceCents: null,
      qty: 1,
      image: null,
    },
  ],
  subtotalCents: null,
  shippingCents: null,
  discountCents: 0,
  totalCents: null,
  shippingAddress: {
    cep: "01001-000",
    street: "Praça da Sé",
    number: "100",
    district: "Sé",
    city: "São Paulo",
    state: "SP",
  },
  customer: {
    name: "Ana",
    email: "ana@teste.dev",
    phone: "(11) 91234-5678",
    cpf: "529.982.247-25",
  },
  shippingService: "PAC",
  ...over,
});

describe("mock orders", () => {
  beforeEach(() => getMockStore().reset());

  it("creates an order awaiting payment", async () => {
    const order = await createMockOrders().create(input(), "key-1");
    expect(order.status).toBe("aguardando_pagamento");
    expect(order.events.map((e) => e.status)).toEqual(["aguardando_pagamento"]);
    expect(order.number).toMatch(/^\d{4}$/);
    expect(order.payment).toBeNull();
  });

  it("returns the same order for the same idempotency key", async () => {
    const port = createMockOrders();
    const [a, b] = await Promise.all([
      port.create(input(), "key-1"),
      port.create(input(), "key-1"),
    ]);
    const c = await port.create(input({ guestToken: "other" }), "key-1");
    expect(a.id).toBe(b.id);
    expect(c.id).toBe(a.id);
    expect(placedOrders()).toHaveLength(1);
    const d = await port.create(input(), "key-2");
    expect(d.id).not.toBe(a.id);
    expect(d.number).not.toBe(a.number);
  });

  it("only shows an order to its owner", async () => {
    const port = createMockOrders();
    const guest = await port.create(input(), "k1");
    const mine = await port.create(input({ userId: "ana", guestToken: null }), "k2");
    expect(await port.get(guest.id, { userId: null, guestTokens: ["guest-1"] })).toMatchObject({
      id: guest.id,
    });
    expect(await port.get(guest.id, { userId: null, guestTokens: ["other"] })).toBeNull();
    expect(await port.get(guest.id, { userId: "ana", guestTokens: [] })).toBeNull();
    expect(await port.get(mine.id, { userId: "ana", guestTokens: [] })).toMatchObject({
      id: mine.id,
    });
    expect(await port.get(mine.id, { userId: "bruno", guestTokens: ["guest-1"] })).toBeNull();
    expect(await port.get("nope", { userId: "ana", guestTokens: [] })).toBeNull();
  });

  it("lists the orders of a user and updates a status", async () => {
    const port = createMockOrders();
    const mine = await port.create(input({ userId: "ana", guestToken: null }), "k2");
    await port.create(input(), "k1");
    expect((await port.listForUser("ana")).map((o) => o.id).slice(0, 1)).toEqual([mine.id]);
    expect(await port.listForUser("ana")).toHaveLength(6);
    await port.setStatus(mine.id, "pago");
    const after = await port.get(mine.id, { userId: "ana", guestTokens: [] });
    expect(after?.status).toBe("pago");
    expect(after?.events.at(-1)?.status).toBe("pago");
  });
});
