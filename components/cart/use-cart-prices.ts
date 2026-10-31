"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { priceCartAction } from "@/app/(loja)/carrinho/actions";
import { priceLine } from "@/lib/cart/price";
import { useCartStore } from "@/lib/cart/store";
import type { PricedLine } from "@/lib/cart/totals";
import type { CartLine } from "@/lib/cart/types";

const NONE: string[] = [];

type CartPrices = {
  /** Current cart lines. */
  lines: CartLine[];
  /** The lines whose product is known, with amounts. Always follows the current quantities. */
  priced: PricedLine[];
  /** Cart ids missing from the catalog (empty while the answer is stale). */
  unknownIds: string[];
  /** No answer yet for a non-empty cart. */
  loading: boolean;
  /** The pricing request failed: the amounts are unknown, so no summary may be shown. */
  error: boolean;
  /** Asks the server again (the "TENTAR DE NOVO" button). */
  retry: () => void;
};

/**
 * Prices the cart on the server (same query key and function for the cart page and the
 * "item collected" drawer, so both share one cache entry). The amounts are re-derived from
 * the products on every render, so a quantity change or a removal shows at once while the
 * refetch for the new lines is still in flight.
 */
export function useCartPrices(): CartPrices {
  const lines = useCartStore((s) => s.lines);
  const query = useQuery({
    queryKey: ["cart-prices", lines],
    queryFn: () => priceCartAction(lines),
    placeholderData: keepPreviousData,
    enabled: lines.length > 0,
    retry: 1,
  });
  const products = new Map(query.data?.lines.map((l) => [l.productId, l.product]));
  const priced = lines.flatMap((l) => {
    const product = products.get(l.productId);
    return product ? [priceLine(l, product)] : [];
  });
  return {
    lines,
    priced,
    unknownIds: query.isPlaceholderData ? NONE : (query.data?.unknownIds ?? NONE),
    loading: lines.length > 0 && query.isPending,
    error: lines.length > 0 && query.isError,
    retry: () => void query.refetch(),
  };
}
