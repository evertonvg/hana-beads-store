"use client";

import { unitCents } from "@/lib/cart/price";
import { priceLabel } from "@/lib/format";
import { usePurchase } from "./AddToCartForm";

/** Price of the product with the selected ring. */
export function ProductPrice({ className }: { className?: string }) {
  const { product, ring } = usePurchase();
  return <p className={className}>{priceLabel(unitCents(product, ring))}</p>;
}
