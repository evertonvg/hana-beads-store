import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, jar } = vi.hoisted(() => ({
  getSession: vi.fn(),
  jar: new Map<string, string>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession }));
vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      set: (name: string, value: string) => void jar.set(name, value),
    }),
}));

import { lookupCepAction, placeOrderAction } from "@/app/(checkout)/checkout/actions";
import { getData } from "@/lib/data";
import { getMockStore } from "@/lib/data/mock/store";
import { placedOrders } from "./placed-orders";
import { MAX_CART_LINES } from "@/lib/cart/types";

const base = {
  name: "Nova Pessoa",
  email: "nova@teste.dev",
  phone: "(11) 91234-5678",
  cpf: "529.982.247-25",
  cep: "01001-000",
  street: "Praça da Sé",
  number: "100",
  complement: "",
  district: "Sé",
  city: "São Paulo",
  state: "SP",
  shippingId: "pac",
  couponCode: "",
  payment: "pix",
  checkoutToken: "3f6c1b1e-6d3b-4c6e-9d27-6f1b7a2d9c11",
  saveAccount: false,
  password: "",
  lines: [{ productId: "garota", ring: "mosquetao", qty: 1 }],
};

beforeEach(() => {
  getMockStore().reset();
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  jar.clear();
});

describe("placeOrderAction", () => {
  it("creates one order per checkout token and remembers it for the guest", async () => {
    const a = await placeOrderAction(base);
    const b = await placeOrderAction(base);
    expect(a.status).toBe("ok");
    expect(a.redirectTo).toMatch(/^\/pedido\/[^/]+\/pagamento$/);
    expect(b.redirectTo).toBe(a.redirectTo);
    const orders = placedOrders();
    expect(orders).toHaveLength(1);
    expect(orders[0]?.userId).toBeNull();
    expect(JSON.parse(jar.get("pp_guest_orders") ?? "[]")).toEqual([orders[0]?.guestToken]);
  });

  it("keeps at most 10 guest tokens", async () => {
    for (let i = 0; i < 12; i++) {
      const suffix = String(i).padStart(2, "0");
      await placeOrderAction({
        ...base,
        checkoutToken: `3f6c1b1e-6d3b-4c6e-9d27-6f1b7a2d9c${suffix}`,
      });
    }
    expect(JSON.parse(jar.get("pp_guest_orders") ?? "[]")).toHaveLength(10);
  });

  it("revalidates with the schema and reports field errors", async () => {
    const r = await placeOrderAction({ ...base, cpf: "111.111.111-11" });
    expect(r.status).toBe("error");
    expect(r.fieldErrors?.cpf).toBe("Informe um CPF válido.");
    expect(placedOrders()).toHaveLength(0);
  });

  it("rejects an empty cart and a shipping id the server did not quote", async () => {
    expect((await placeOrderAction({ ...base, lines: [] })).status).toBe("error");
    const r = await placeOrderAction({ ...base, shippingId: "gratis" });
    expect(r.fieldErrors?.shippingId).toBeDefined();
    expect(placedOrders()).toHaveLength(0);
  });

  it("refuses a cart with more lines than a client can send instead of cutting it", async () => {
    const lines = Array.from({ length: MAX_CART_LINES + 1 }, () => base.lines[0]);
    const r = await placeOrderAction({ ...base, lines });
    expect(r.status).toBe("error");
    expect(placedOrders()).toHaveLength(0);
  });

  it("re-validates the coupon on the server", async () => {
    const bad = await placeOrderAction({ ...base, couponCode: "EXPIRADO" });
    expect(bad.status).toBe("error");
    expect(placedOrders()).toHaveLength(0);
    const ok = await placeOrderAction({ ...base, couponCode: "teste10" });
    expect(ok.status).toBe("ok");
  });

  it("uses the signed-in user and no guest token", async () => {
    getSession.mockResolvedValue({ id: "ana", name: "Ana Souza", email: "ana@teste.dev" });
    await placeOrderAction(base);
    expect(getMockStore().orders[0]).toMatchObject({ userId: "ana", guestToken: null });
    expect(jar.has("pp_guest_orders")).toBe(false);
  });

  it("creates the account pending confirmation and places a guest order already tied to it", async () => {
    const r = await placeOrderAction({ ...base, saveAccount: true, password: "Senha@123" });
    expect(r).toMatchObject({ status: "ok", accountPending: true });
    expect(r.redirectTo).toMatch(/^\/pedido\/[^/]+\/pagamento\?conta=pendente$/);
    expect(r).not.toHaveProperty("userId");
    const pending = getMockStore().pendingUsers.find((u) => u.email === "nova@teste.dev");
    expect(pending).toBeDefined();
    expect(
      getMockStore().inbox.map((m) => [m.kind, m.link.includes("next=%2Fconta%2Fpedidos")]),
    ).toEqual([["confirmacao", true]]);
    const order = placedOrders()[0];
    expect(order).toMatchObject({ userId: pending?.id });
    expect(order?.guestToken).toBeTruthy();
    expect(JSON.parse(jar.get("pp_guest_orders") ?? "[]")).toEqual([order?.guestToken]);
  });

  it("gives the client the same answer when the e-mail already has an account", async () => {
    const r = await placeOrderAction({
      ...base,
      email: "ana@teste.dev",
      saveAccount: true,
      password: "Senha@123",
    });
    const fresh = await placeOrderAction({
      ...base,
      checkoutToken: "3f6c1b1e-6d3b-4c6e-9d27-6f1b7a2d9c99",
      saveAccount: true,
      password: "Senha@123",
    });
    const shape = (x: typeof r) => ({
      ...x,
      redirectTo: x.redirectTo?.replace(/[^/]+(?=\/pagamento)/, "ID"),
    });
    expect(shape(r)).toEqual(shape(fresh));
    expect(r).toMatchObject({ status: "ok", accountPending: true });
    const order = placedOrders().find((o) => o.customer.email === "ana@teste.dev");
    expect(order).toMatchObject({ userId: null });
    expect(order?.guestToken).toBeTruthy();
    expect(getMockStore().inbox.filter((m) => m.to === "ana@teste.dev")).toEqual([]);
  });

  it("does not mark the account pending without 'save my data'", async () => {
    const r = await placeOrderAction(base);
    expect(r).toMatchObject({ status: "ok", accountPending: false });
    expect(r.redirectTo).not.toContain("conta=pendente");
  });
});

describe("card data", () => {
  const card = { number: "4111111111111111", holder: "ANA SOUZA", expiry: "12/30", cvv: "7391" };

  it("needs a card token for card payments and ignores raw card fields", async () => {
    const noToken = await placeOrderAction({ ...base, payment: "cartao", card });
    expect(noToken.status).toBe("error");
    expect(noToken.fieldErrors?.cardToken).toBeDefined();
    expect(placedOrders()).toHaveLength(0);

    const ok = await placeOrderAction({
      ...base,
      payment: "cartao",
      cardToken: "mock_tok_3f6c1b1e-6d3b",
      cardLast4: "1111",
      card,
    });
    expect(ok.status).toBe("ok");
    const stored = JSON.stringify(getMockStore().orders);
    expect(stored).not.toContain(card.number);
    expect(stored).not.toContain(card.cvv);
  });
});

describe("payment start", () => {
  it("starts the Pix with the order and goes to the payment screen", async () => {
    const r = await placeOrderAction(base);
    expect(r.redirectTo).toMatch(/\/pagamento$/);
    expect(getMockStore().orders[0]?.payment).toMatchObject({
      kind: "pix",
      copyPaste: "[codigo-pix]",
    });
  });

  it("sends an approved card straight to the confirmation", async () => {
    const r = await placeOrderAction({
      ...base,
      payment: "cartao",
      cardToken: "mock_tok_3f6c1b1e-6d3b",
      cardLast4: "1111",
    });
    expect(r.redirectTo).toMatch(/\/confirmado$/);
    expect(getMockStore().orders[0]?.status).toBe("pago");
  });

  it("keeps a declined card awaiting payment on the payment screen", async () => {
    const r = await placeOrderAction({
      ...base,
      payment: "cartao",
      cardToken: "mock_tok_declined_3f6c1b1e-6d3b",
      cardLast4: "0002",
    });
    expect(r.redirectTo).toMatch(/\/pagamento$/);
    expect(getMockStore().orders[0]).toMatchObject({
      status: "aguardando_pagamento",
      payment: { kind: "cartao", result: "recusado", last4: "0002" },
    });
  });

  it("does not start the payment again for a retried checkout token", async () => {
    await placeOrderAction(base);
    const first = getMockStore().orders[0]?.payment;
    await placeOrderAction(base);
    expect(getMockStore().orders[0]?.payment).toEqual(first);
  });
});

describe("retry after a partial failure", () => {
  it("tells the client who owns the order so it can sync the cart owner", async () => {
    const create = vi.spyOn(getData().orders, "create").mockRejectedValueOnce(new Error("boom"));
    const first = await placeOrderAction({ ...base, saveAccount: true, password: "Senha@123" });
    expect(first.status).toBe("error");
    const user = getMockStore().pendingUsers.find((u) => u.email === "nova@teste.dev");
    expect(user).toBeDefined();
    // Signed in by the retry (e.g. after confirming the e-mail): the order goes to that user.
    getSession.mockResolvedValue({ id: user?.id, name: "Nova Pessoa", email: "nova@teste.dev" });
    const retry = await placeOrderAction({ ...base, saveAccount: true, password: "Senha@123" });
    create.mockRestore();
    expect(retry).toMatchObject({ status: "ok", accountPending: false, userId: user?.id });
    expect(getMockStore().orders[0]?.userId).toBe(user?.id);
  });

  it("returns no user id for a guest order", async () => {
    expect((await placeOrderAction(base)).userId).toBeUndefined();
  });
});

describe("lookupCepAction", () => {
  it("fills the Praça da Sé and returns null for other valid CEPs", async () => {
    expect(await lookupCepAction("01001-000")).toMatchObject({
      street: "Praça da Sé",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
    });
    expect(await lookupCepAction("13400-000")).toBeNull();
    expect(await lookupCepAction("123")).toBeNull();
  });
});
