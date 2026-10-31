import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { priceCartAction, quoteShippingAction } from "@/app/(loja)/carrinho/actions";
import { MAX_CART_LINES } from "@/lib/cart/types";

const line = { productId: "garota", ring: "mosquetao" as const, qty: 1 };

describe("cart action input cap", () => {
  it("prices a cart of exactly the maximum number of lines", async () => {
    const r = await priceCartAction(Array.from({ length: MAX_CART_LINES }, () => line));
    expect(r.lines).toHaveLength(1);
  });

  it("priceCartAction treats more than the maximum as malformed (empty)", async () => {
    const r = await priceCartAction(Array.from({ length: MAX_CART_LINES + 1 }, () => line));
    expect(r).toEqual({ lines: [], unknownIds: [] });
  });

  it("quoteShippingAction ignores more than the maximum number of items", async () => {
    const items = Array.from({ length: MAX_CART_LINES + 1 }, () => ({
      productId: "garota",
      qty: 1,
    }));
    const { getData } = await import("@/lib/data");
    const spy = vi.spyOn(getData().shipping, "quote");
    await quoteShippingAction({ cep: "01001-000", items });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ items: [] }));
    spy.mockRestore();
  });
});
