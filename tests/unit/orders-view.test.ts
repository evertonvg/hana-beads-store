import { beforeEach, describe, expect, it } from "vitest";
import { createMockOrders } from "@/lib/data/mock/orders";
import { getMockStore } from "@/lib/data/mock/store";
import type { Order, OrderStatus } from "@/lib/data/types";
import { filterOrders, orderStatusView, type OrderFilter } from "@/lib/orders-view";

const ana = () => createMockOrders().listForUser("ana");
const byNumber = (orders: Order[], n: string) => {
  const found = orders.find((o) => o.number === n);
  if (!found) throw new Error(`fixture order ${n} missing`);
  return found;
};
const withStatus = (o: Order, status: OrderStatus): Order => ({ ...o, status });

describe("ana's order fixtures", () => {
  beforeEach(() => getMockStore().reset());

  it("lists #0001 to #0005, newest first", async () => {
    const orders = await ana();
    expect(orders.map((o) => o.number)).toEqual(["0005", "0004", "0003", "0002", "0001"]);
  });

  it("gives bruno none", async () => {
    expect(await createMockOrders().listForUser("bruno")).toEqual([]);
  });

  it("hides them from another user (RLS)", async () => {
    const viewer = { userId: "bruno", guestTokens: [] };
    expect(await createMockOrders().get("ord_0003", viewer)).toBeNull();
    expect(
      (await createMockOrders().get("ord_0003", { userId: "ana", guestTokens: [] }))?.number,
    ).toBe("0003");
  });

  it("numbers a new order after the fixtures", async () => {
    const created = await createMockOrders().create(
      {
        userId: "bruno",
        guestToken: null,
        paymentMethod: "pix",
        items: [],
        subtotalCents: null,
        shippingCents: null,
        discountCents: 0,
        totalCents: null,
        shippingAddress: (await ana())[0].shippingAddress,
        customer: (await ana())[0].customer,
        shippingService: "PAC",
      },
      "k1",
    );
    expect(created.number).toBe("0006");
  });
});

describe("filterOrders", () => {
  beforeEach(() => getMockStore().reset());

  it.each<[OrderFilter, number]>([
    ["todos", 5],
    ["andamento", 3],
    ["entregues", 1],
    ["cancelados", 1],
  ])("counts %s", async (filter, count) => {
    expect(filterOrders(await ana(), filter, "")).toHaveLength(count);
  });

  it("searches by item name, ignoring case and accents", async () => {
    const orders = await ana();
    expect(filterOrders(orders, "todos", "estrela").map((o) => o.number)).toEqual([
      "0005",
      "0003",
      "0001",
    ]);
    expect(filterOrders(orders, "todos", "ESTRELA")).toHaveLength(3);
    expect(filterOrders(orders, "todos", "garota")).toHaveLength(2);
  });

  it("searches by number, with or without #", async () => {
    const orders = await ana();
    expect(filterOrders(orders, "todos", "#0004").map((o) => o.number)).toEqual(["0004"]);
    expect(filterOrders(orders, "todos", "0004")).toHaveLength(1);
  });

  it("combines the filter and the search", async () => {
    const orders = await ana();
    expect(filterOrders(orders, "andamento", "estrela")).toHaveLength(2);
    expect(filterOrders(orders, "entregues", "estrela")).toHaveLength(0);
  });
});

describe("orderStatusView", () => {
  beforeEach(() => getMockStore().reset());

  it("em_producao: step 2 and the contact action", async () => {
    const v = orderStatusView(byNumber(await ana(), "0005"));
    expect(v).toMatchObject({
      label: "EM PRODUÇÃO",
      group: "andamento",
      step: 2,
      action: { label: "FALAR NO DIRECT" },
    });
  });

  it("follows the configured channel", async () => {
    const whatsapp = {
      id: "whatsapp",
      short: "WHATSAPP",
      href: () => "https://wa.me/1",
    } as unknown as Parameters<typeof orderStatusView>[1];
    const v = orderStatusView(byNumber(await ana(), "0005"), whatsapp);
    expect(v.action).toEqual({ label: "FALAR NO WHATSAPP", href: "https://wa.me/1" });
  });

  it("maps every status of the design", async () => {
    const o = byNumber(await ana(), "0005");
    const pick = (s: OrderStatus) => {
      const v = orderStatusView(withStatus(o, s), undefined, { garota: "garota-pixel" });
      return [v.label, v.group, v.step, v.action.label];
    };
    expect(pick("aguardando_aprovacao")).toEqual([
      "AGUARDANDO APROVAÇÃO",
      "andamento",
      0,
      "VER NO DIRECT",
    ]);
    expect(pick("aguardando_pagamento")).toEqual(["AGUARDANDO PAGAMENTO", "andamento", 0, "PAGAR"]);
    expect(pick("pago")).toEqual(["PAGO", "andamento", 1, "FALAR NO DIRECT"]);
    expect(pick("enviado")).toEqual(["ENVIADO", "andamento", 3, "RASTREAR"]);
    expect(pick("entregue")).toEqual(["ENTREGUE", "entregues", 4, "COMPRAR DE NOVO"]);
    expect(pick("cancelado")).toEqual(["CANCELADO", "cancelados", 0, "VER PRODUTO"]);
    expect(pick("reembolsado")).toEqual(["REEMBOLSADO", "cancelados", 0, "VER PRODUTO"]);
  });

  it("links: pay, track, buy again", async () => {
    const o = byNumber(await ana(), "0005");
    const href = (s: OrderStatus) =>
      orderStatusView(withStatus(o, s), undefined, { garota: "garota-pixel" }).action.href;
    expect(href("aguardando_pagamento")).toBe(`/pedido/${o.id}/pagamento`);
    expect(href("enviado")).toBe(`#rastreio-${o.id}`);
    expect(href("entregue")).toBe("/produto/garota-pixel");
    expect(href("cancelado")).toBe("/produto/garota-pixel");
  });

  it("falls back to the shop when the product is unknown (custom order)", async () => {
    const custom = byNumber(await ana(), "0004");
    expect(orderStatusView(withStatus(custom, "entregue")).action.href).toBe("/loja");
  });
});
