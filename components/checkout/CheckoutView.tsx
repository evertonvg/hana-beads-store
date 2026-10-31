"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCartPrices } from "@/components/cart/use-cart-prices";
import { useCartStore } from "@/lib/cart/store";
import { useCartHydrated } from "@/lib/cart/use-cart-hydrated";
import { PricesError } from "@/components/cart/PricesError";
import { CheckoutForm, type CheckoutInitial } from "./CheckoutForm";
import { CheckoutSteps } from "./CheckoutSteps";

/** Page frame: `SAVE GAME` heading and steps, then the form once the cart is known. */
export function CheckoutFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 pt-5 pb-0 md:gap-10 md:px-6 md:pt-12 md:pb-24">
      <div className="flex flex-col gap-3.5 md:gap-6">
        <h1 className="m-0 font-pixel text-[13px] leading-snug md:text-[28px] md:leading-snug">
          SAVE <span className="text-accent">GAME</span>
        </h1>
        <CheckoutSteps />
      </div>
      {children ?? <div aria-hidden="true" className="min-h-[640px]" />}
    </div>
  );
}

function CheckoutContent({ initial }: { initial: CheckoutInitial }) {
  const router = useRouter();
  const { lines, priced, unknownIds, loading, error, retry } = useCartPrices();

  // An empty cart has nothing to pay for: back to the inventory.
  useEffect(() => {
    if (lines.length === 0) router.replace("/carrinho");
  }, [lines.length, router]);

  // Products that left the catalog drop out of the stored cart.
  useEffect(() => {
    if (unknownIds.length === 0) return;
    const store = useCartStore.getState();
    store.pruneUnknown(
      store.lines.map((l) => l.productId).filter((id) => !unknownIds.includes(id)),
    );
  }, [unknownIds]);

  if (lines.length === 0 || loading) {
    return (
      <div role="status" className="font-pixel text-[10px] text-text-muted">
        CARREGANDO…
      </div>
    );
  }
  if (error) return <PricesError onRetry={retry} />;
  return <CheckoutForm initial={initial} lines={lines} priced={priced} />;
}

/** The form needs the persisted cart (localStorage), so it only mounts after the store hydrates. */
export function CheckoutView({ initial }: { initial: CheckoutInitial }) {
  const hydrated = useCartHydrated();
  return (
    <CheckoutFrame>{hydrated ? <CheckoutContent initial={initial} /> : undefined}</CheckoutFrame>
  );
}
