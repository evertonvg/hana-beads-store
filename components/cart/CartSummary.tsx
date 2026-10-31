import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { CheckoutDraft } from "@/lib/cart/draft";
import type { ShippingQuote } from "@/lib/data/ports";
import { totalLabel } from "@/lib/format";

type Props = {
  subtotalCents: number | null;
  totalCents: number | null;
  shipping: ShippingQuote | null;
  coupon: CheckoutDraft["coupon"];
  /** The CEP and coupon controls, placed between the subtotal and the shipping/discount rows. */
  children: ReactNode;
};

function Row({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm md:text-[15px]">
      <span>{label}</span>
      {note ? <span className="flex-1 text-xs text-text-muted">{note}</span> : null}
      <span className="text-right">{value}</span>
    </div>
  );
}

const finalizar = cn(
  buttonVariants({ variant: "primary" }),
  "shadow-[5px_5px_0_var(--color-yellow)] md:text-xs",
);

/**
 * Order summary: a boxed aside from md up, plain sections below it, where the total and the
 * checkout link live in a bar stuck to the bottom instead.
 */
export function CartSummary({ subtotalCents, totalCents, shipping, coupon, children }: Props) {
  return (
    <>
      <aside
        aria-labelledby="resumo"
        className="flex min-w-0 flex-col gap-5 md:flex-[1_1_320px] md:border-4 md:border-text md:bg-surface-2 md:p-6 md:shadow-[10px_10px_0_var(--color-accent)]"
      >
        <h2 id="resumo" className="m-0 font-pixel text-[13px] max-md:sr-only">
          RESUMO
        </h2>
        <div className="flex flex-col gap-5">
          <Row label="Subtotal" value={totalLabel(subtotalCents)} />
          <div className="flex flex-col gap-5">{children}</div>
          <Row
            label="Frete"
            value={
              shipping
                ? `${shipping.service} · ${totalLabel(shipping.priceCents)}`
                : "calcule acima"
            }
          />
          {coupon ? (
            <Row
              label="Desconto"
              note={`${coupon.code} · ${coupon.label}`}
              value={
                coupon.discountCents === null
                  ? totalLabel(null)
                  : `−${totalLabel(coupon.discountCents)}`
              }
            />
          ) : null}
        </div>
        <div className="hidden items-center justify-between border-t-[3px] border-dashed border-border pt-[18px] md:flex">
          <span className="font-pixel text-xs">TOTAL</span>
          <span data-testid="cart-total" className="font-pixel text-sm text-yellow">
            {totalLabel(totalCents)}
          </span>
        </div>
        <Link href="/checkout" className={cn(finalizar, "hidden md:inline-flex")}>
          FINALIZAR ›
        </Link>
      </aside>
      <div className="sticky bottom-0 z-10 -mx-4 flex basis-[calc(100%+2rem)] items-center gap-3.5 border-t-[3px] border-text bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-text-subtle">Total</span>
          <span data-testid="cart-total" className="font-pixel text-[11px] text-yellow">
            {totalLabel(totalCents)}
          </span>
        </div>
        <Link href="/checkout" className={cn(finalizar, "flex-1 py-5")}>
          FINALIZAR ›
        </Link>
      </div>
    </>
  );
}
