import { beforeEach, describe, expect, it } from "vitest";
import { createMockReturns } from "@/lib/data/mock/returns";
import { getMockStore } from "@/lib/data/mock/store";

const req = (orderId: string, over: object = {}) => ({
  orderId,
  reason: "defeito" as const,
  description: "A argola quebrou na primeira semana.",
  preference: "troca" as const,
  photos: [new File([new Uint8Array(4)], "foto.webp", { type: "image/webp" })],
  ...over,
});

describe("mock returns", () => {
  beforeEach(() => getMockStore().reset());

  it("numbers protocols T-0001, T-0002 and a reset starts over", async () => {
    const returns = createMockReturns();
    expect(await returns.create("ana", req("ord_0002"))).toEqual({ protocol: "T-0001" });
    expect(await returns.create("ana", req("ord_0003"))).toEqual({ protocol: "T-0002" });
    getMockStore().reset();
    expect(await returns.create("ana", req("ord_0002"))).toEqual({ protocol: "T-0001" });
  });

  it("stores only photo metadata, never the bytes", async () => {
    await createMockReturns().create("ana", req("ord_0002"));
    expect(getMockStore().returns[0]?.photos).toEqual([
      { name: "foto.webp", type: "image/webp", size: 4 },
    ]);
  });

  it("does not find an order of another user or an unknown one", async () => {
    const returns = createMockReturns();
    expect(await returns.create("bruno", req("ord_0002"))).toEqual({
      error: "pedido_nao_encontrado",
    });
    expect(await returns.create("ana", req("ord_9999"))).toEqual({
      error: "pedido_nao_encontrado",
    });
    expect(getMockStore().returns).toHaveLength(0);
  });

  it("refuses orders that were not shipped yet", async () => {
    expect(await createMockReturns().create("ana", req("ord_0005"))).toEqual({
      error: "pedido_indisponivel",
    });
  });

  it("allows regret only within 7 days of delivery", async () => {
    const returns = createMockReturns();
    const regret = req("ord_0002", { reason: "arrependimento" });
    expect(await returns.create("ana", regret)).toEqual({ error: "fora_do_prazo" });
    const order = getMockStore().orders.find((o) => o.id === "ord_0002")!;
    order.events = [
      { status: "entregue", at: new Date(Date.now() - 6 * 86_400_000).toISOString() },
    ];
    expect(await returns.create("ana", regret)).toEqual({ protocol: "T-0001" });
    order.events = [
      { status: "entregue", at: new Date(Date.now() - 8 * 86_400_000).toISOString() },
    ];
    expect(await returns.create("ana", regret)).toEqual({ error: "fora_do_prazo" });
  });
});
