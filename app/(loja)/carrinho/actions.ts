"use server";

import { hasTooManyLines, sanitizeCart } from "@/lib/cart/merge";
import { priceLine } from "@/lib/cart/price";
import { computeTotals, type PricedLine } from "@/lib/cart/totals";
import { clampQty, MAX_CART_LINES, type CartLine } from "@/lib/cart/types";
import { getData } from "@/lib/data";
import type { CouponResult, ShippingError, ShippingQuote } from "@/lib/data/ports";
import { z } from "zod";
import { couponSchema } from "@/lib/validation/coupon";

const itemsSchema = z.array(z.custom<{ productId: string; qty: number }>()).max(MAX_CART_LINES);

export type PricedCart = { lines: PricedLine[]; unknownIds: string[] };

/**
 * Prices are always resolved here: the client only sends product ids, rings and quantities, and
 * anything malformed is dropped by `sanitizeCart`.
 */
async function priceCart(lines: unknown): Promise<PricedCart> {
  if (hasTooManyLines(lines)) return { lines: [], unknownIds: [] };
  const clean = sanitizeCart({ lines }).lines;
  const ids = [...new Set(clean.map((l) => l.productId))];
  const products = await getData().catalog.byIds(ids);
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    lines: clean.flatMap((l) => {
      const product = byId.get(l.productId);
      return product ? [priceLine(l, product)] : [];
    }),
    unknownIds: ids.filter((id) => !byId.has(id)),
  };
}

/** Cart lines with their products and amounts, plus the ids that no longer exist in the catalog. */
export async function priceCartAction(lines: CartLine[]): Promise<PricedCart> {
  return priceCart(lines);
}

/** Shipping options for a CEP. Items for products that no longer exist are left out. */
export async function quoteShippingAction(input: {
  cep: string;
  items: { productId: string; qty: number }[];
}): Promise<ShippingQuote[] | ShippingError> {
  const parsedItems = itemsSchema.safeParse(input.items);
  const requested = (parsedItems.success ? parsedItems.data : []).filter(
    (i) => typeof i?.productId === "string" && typeof i.qty === "number",
  );
  const products = await getData().catalog.byIds([...new Set(requested.map((i) => i.productId))]);
  const known = new Set(products.map((p) => p.id));
  const items = requested
    .filter((i) => known.has(i.productId))
    .map((i) => ({ productId: i.productId, qty: clampQty(i.qty) }));
  return getData().shipping.quote({ cep: String(input.cep), items });
}

/** Checks a coupon against the subtotal the server computes from the cart lines. */
export async function validateCouponAction(input: {
  code: string;
  lines: CartLine[];
}): Promise<CouponResult> {
  const parsed = couponSchema.safeParse({ code: input.code });
  if (!parsed.success) return { ok: false, reason: "invalido" };
  const { lines } = await priceCart(input.lines);
  const subtotal = lines.length > 0 ? computeTotals(lines, 0, 0).subtotalCents : null;
  return getData().coupons.validate(parsed.data.code, subtotal);
}
