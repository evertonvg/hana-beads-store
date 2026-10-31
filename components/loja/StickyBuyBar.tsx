"use client";

import { Button } from "@/components/ui/Button";
import { unitCents } from "@/lib/cart/price";
import { priceLabel } from "@/lib/format";
import { usePurchase } from "./AddToCartForm";

/** Mobile buy bar, sticky at the end of the page content (the tab bar is hidden here). */
export function StickyBuyBar() {
  const { product, ring, qty, adding, add } = usePurchase();
  // Sold out: the form already offers AVISE-ME, so the bar steps aside.
  if (product.stock === 0) return null;

  return (
    <div
      role="group"
      aria-label="Compra rápida"
      className="sticky bottom-0 z-10 flex items-center gap-3.5 border-t-[3px] border-text bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-subtle">{qty} un.</span>
        <span className="font-pixel text-[11px] text-yellow">
          {priceLabel(unitCents(product, ring))}
        </span>
      </div>
      <Button
        variant="primary"
        onClick={add}
        disabled={adding}
        aria-busy={adding}
        className="flex-1 shadow-[4px_4px_0_var(--color-yellow)]"
      >
        + PEGAR ITEM
      </Button>
    </div>
  );
}
