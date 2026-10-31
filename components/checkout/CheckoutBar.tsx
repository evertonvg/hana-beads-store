import { Button } from "@/components/ui/Button";
import { totalLabel } from "@/lib/format";

type Props = { totalCents: number | null; pending: boolean };

/** Mobile bar stuck to the bottom: total and the submit button of the checkout form. */
export function CheckoutBar({ totalCents, pending }: Props) {
  return (
    <div
      data-testid="checkout-bar"
      className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3.5 border-t-[3px] border-text bg-surface px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-subtle">Total</span>
        <span data-testid="checkout-total" className="font-pixel text-[11px] text-yellow">
          {totalLabel(totalCents)}
        </span>
      </div>
      <Button
        type="submit"
        form="checkout-form"
        variant="primary"
        disabled={pending}
        aria-busy={pending}
        className="flex-1 py-5 text-[10px] shadow-[4px_4px_0_var(--color-yellow)]"
      >
        SAVE GAME <span aria-hidden="true">›</span>
      </Button>
    </div>
  );
}
