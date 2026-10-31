"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { computeTotals } from "@/lib/cart/totals";
import { readDraft, writeDraft, type CheckoutDraft } from "@/lib/cart/draft";
import { useCartStore } from "@/lib/cart/store";
import { lineKey } from "@/lib/cart/types";
import { useCartHydrated } from "@/lib/cart/use-cart-hydrated";
import { CartEmpty } from "./CartEmpty";
import { CartLine } from "./CartLine";
import { CartSummary } from "./CartSummary";
import { CouponForm } from "./CouponForm";
import { PricesError } from "./PricesError";
import { FreeShippingBar } from "./FreeShippingBar";
import { ShippingQuoteBox } from "./ShippingQuote";
import { useCartPrices } from "./use-cart-prices";

const REMOVED_TOAST_ID = "cart-removed";

function Heading({ count }: { count: number | null }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="m-0 font-pixel text-sm leading-snug md:text-[32px] md:leading-snug">
        INVENTÁRIO
      </h1>
      {count !== null && count > 0 ? (
        <span aria-live="polite" className="font-pixel text-[9px] text-yellow md:text-[10px]">
          {count} {count === 1 ? "ITEM COLETADO" : "ITENS COLETADOS"}
        </span>
      ) : null}
    </div>
  );
}

function CartContent({ suggestions }: { suggestions: ReactNode }) {
  const { lines, priced, unknownIds, loading, error, retry } = useCartPrices();
  const lastRemoved = useCartStore((s) => s.lastRemoved);
  const [draft, setDraft] = useState<CheckoutDraft>(readDraft);
  const patchDraft = (patch: Partial<CheckoutDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // The checkout reads the CEP, shipping options, choice and coupon from here.
  useEffect(() => writeDraft(draft), [draft]);

  // Products that left the catalog drop out of the stored cart (and the header badge with it).
  useEffect(() => {
    if (unknownIds.length === 0) return;
    const store = useCartStore.getState();
    store.pruneUnknown(
      store.lines.map((l) => l.productId).filter((id) => !unknownIds.includes(id)),
    );
  }, [unknownIds]);

  const shipping = draft.quotes.find((q) => q.id === draft.shippingId) ?? null;
  const discountCents = draft.coupon?.discountCents ?? 0;
  const totals = computeTotals(priced, shipping ? shipping.priceCents : 0, discountCents);

  // After a removal the focused button is gone: move to the next (or previous) line's remove
  // button, or to the empty-cart heading.
  const focusKey = useRef<string | null>(null);
  useEffect(() => {
    if (focusKey.current === null) return;
    const key = focusKey.current;
    focusKey.current = null;
    document.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  }, [lines]);

  const remove = (key: string) => {
    const at = priced.findIndex((l) => lineKey(l) === key);
    const near = priced[at + 1] ?? priced[at - 1];
    focusKey.current = near ? lineKey(near) : "empty";
    useCartStore.getState().remove(key);
    toast("Item removido.", {
      id: REMOVED_TOAST_ID,
      duration: 6000,
      action: { label: "DESFAZER", onClick: () => useCartStore.getState().undo() },
    });
  };

  if (lines.length === 0) {
    return (
      <>
        <Heading count={null} />
        <CartEmpty
          onRestore={lastRemoved ? () => useCartStore.getState().undo() : null}
          suggestions={suggestions}
        />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Heading count={null} />
        <div role="status" className="font-pixel text-[10px] text-text-muted">
          CARREGANDO…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Heading count={null} />
        <PricesError onRetry={retry} />
      </>
    );
  }

  return (
    <>
      <Heading count={totals.itemCount} />
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex min-w-0 flex-col gap-4 md:flex-[999_1_560px]">
          <ul
            aria-label="Itens do carrinho"
            className="m-0 flex list-none flex-col gap-3 p-0 md:gap-4"
          >
            {priced.map((line) => (
              <CartLine
                key={lineKey(line)}
                line={line}
                onQty={(qty) => useCartStore.getState().setQty(lineKey(line), qty)}
                onRemove={() => remove(lineKey(line))}
              />
            ))}
          </ul>
          <FreeShippingBar subtotalCents={totals.subtotalCents} />
          <Link
            href="/loja"
            className={cn(
              "inline-flex min-h-11 items-center self-start font-pixel text-[10px] text-link no-underline hover:text-yellow",
              focusRing,
            )}
          >
            ‹ CONTINUAR JOGANDO
          </Link>
        </div>
        <CartSummary
          subtotalCents={totals.subtotalCents}
          totalCents={totals.totalCents}
          shipping={shipping}
          coupon={draft.coupon}
        >
          <ShippingQuoteBox
            cep={draft.cep}
            quotes={draft.quotes}
            selectedId={draft.shippingId}
            items={lines.map((l) => ({ productId: l.productId, qty: l.qty }))}
            onQuoted={(cep, quotes) => patchDraft({ cep, quotes, shippingId: null })}
            onSelect={(shippingId) => patchDraft({ shippingId })}
          />
          <CouponForm
            lines={lines}
            coupon={draft.coupon}
            onChange={(coupon) => patchDraft({ coupon })}
          />
        </CartSummary>
      </div>
    </>
  );
}

/** Cart page body: lines, shipping, coupon and summary, or the empty inventory. */
export function CartView({ suggestions }: { suggestions: ReactNode }) {
  const hydrated = useCartHydrated();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pt-5 pb-0 md:gap-10 md:px-6 md:pt-14 md:pb-24">
      {hydrated ? (
        <CartContent suggestions={suggestions} />
      ) : (
        <>
          <Heading count={null} />
          <div aria-hidden="true" className="min-h-[480px]" />
        </>
      )}
    </div>
  );
}
