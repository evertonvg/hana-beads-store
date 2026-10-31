import Image from "next/image";
import type { Order } from "@/lib/data/types";
import { formatOrderNumber, totalLabel } from "@/lib/format";

type Props = Pick<Order, "items" | "number" | "totalCents">;

/** Order summary next to the Pix code (desktop only; the mobile card carries number and total). */
export function OrderAside({ items, number, totalCents }: Props) {
  return (
    <aside
      aria-label="Resumo do pedido"
      className="hidden min-w-0 flex-[1_1_300px] flex-col gap-4 border-[3px] border-border p-6 md:flex"
    >
      <h2 className="font-pixel text-[11px]">PEDIDO {formatOrderNumber(number)}</h2>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {items.map((item) => (
          <li key={`${item.productId}:${item.ring}`} className="flex items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden border-2 border-text bg-deep">
              {item.image ? (
                <Image
                  src={item.image.url}
                  alt={item.image.alt}
                  width={56}
                  height={56}
                  className="size-full object-cover"
                />
              ) : null}
            </div>
            <span className="min-w-0 flex-1 text-sm break-words">
              {item.name} ×{item.qty}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t-[3px] border-dashed border-border pt-3.5">
        <span className="font-pixel text-[11px]">TOTAL</span>
        <span className="font-pixel text-sm text-yellow">{totalLabel(totalCents)}</span>
      </div>
      <p className="m-0 text-xs leading-relaxed text-text-subtle">
        Se o tempo acabar, o código expira e você pode gerar outro sem perder o carrinho.
      </p>
    </aside>
  );
}
