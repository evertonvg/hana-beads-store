import { beforeEach, describe, expect, it } from "vitest";
import { createMockOrders } from "@/lib/data/mock/orders";
import { getMockStore } from "@/lib/data/mock/store";
import { toClientOrder, toPaymentView } from "@/lib/order-view-model";

const PRIVATE = [
  "cpf",
  "email",
  "phone",
  "guestToken",
  "userId",
  "529.982.247-25",
  "ana@teste.dev",
];

describe("order view models", () => {
  beforeEach(() => getMockStore().reset());

  it("toClientOrder drops customer data, owner ids and non-card payment details", async () => {
    const orders = await createMockOrders().listForUser("ana");
    for (const order of orders) {
      const json = JSON.stringify(toClientOrder({ ...order, guestToken: "tok_secret" }));
      for (const secret of [...PRIVATE, "tok_secret", "copyPaste", "[pix copia e cola]"]) {
        expect(json).not.toContain(secret);
      }
    }
    const [shipped] = orders.filter((o) => o.number === "0003");
    expect(toClientOrder(shipped)).toMatchObject({
      id: shipped.id,
      number: "0003",
      shippingAddress: shipped.shippingAddress,
      payment: { kind: "cartao", last4: "0000" },
    });
  });

  it("toPaymentView keeps only what the payment screens render", async () => {
    const [order] = await createMockOrders().listForUser("ana");
    const view = toPaymentView(order);
    expect(Object.keys(view).sort()).toEqual(["id", "items", "number", "status", "totalCents"]);
    expect(JSON.stringify(view)).not.toContain("teste.dev");
  });
});
