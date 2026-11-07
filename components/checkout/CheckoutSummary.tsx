import Image from "next/image";
import { BeadArt } from "@/components/pixel/BeadArt";
import { cn } from "@/lib/cn";
import type { CheckoutDraft } from "@/lib/cart/draft";
import type { PricedLine } from "@/lib/cart/totals";
import type { ShippingQuote } from "@/lib/data/ports";
import { priceLabel, totalLabel } from "@/lib/format";

type Props = {
  lines: PricedLine[];
  itemCount: number;
  subtotalCents: number | null;
  totalCents: number | null;
  shipping: ShippingQuote | null;
  coupon: CheckoutDraft["coupon"];
};

function Thumb({ line, size }: { line: PricedLine; size: number }) {
  const { product } = line;
  const photo = product.images[0];
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden border-2 border-text bg-deep"
      style={{ width: size, height: size }}
    >
      {photo ? (
        <Image
          src={photo.url}
          alt={photo.alt}
          width={size}
          height={size}
          className="size-full object-cover"
        />
      ) : product.art ? (
        <BeadArt
          rows={product.art.rows}
          palette={product.art.palette}
          cell={size === 48 ? 4 : 5}
          gap={1}
          label={product.art.alt}
        />
      ) : null}
    </div>
  );
}

function Items({
  lines,
  size,
  className,
}: {
  lines: PricedLine[];
  size: number;
  className: string;
}) {
  return (
    <ul className="m-0 flex list-none flex-col p-0" aria-label="Itens do pedido">
      {lines.map((line) => (
        <li key={`${line.productId}:${line.ring}`} className={cn("flex items-center", className)}>
          <Thumb line={line} size={size} />
          <span className="min-w-0 flex-1 break-words">
            {line.product.name} ×{line.qty}
          </span>
          <span className="shrink-0 whitespace-nowrap">{priceLabel(line.lineCents)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Mobile: the order collapsed into a box with the total, above the form. */
export function SummaryDetails({ lines, itemCount, totalCents }: Props) {
  return (
    <details className="group border-[3px] border-text bg-surface-2 p-3.5 md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 outline-offset-4 outline-cyan focus-visible:outline-[3px] [&::-webkit-details-marker]:hidden">
        <span className="font-pixel text-[9px]">
          RESUMO · {itemCount} {itemCount === 1 ? "ITEM" : "ITENS"}{" "}
          <span aria-hidden="true" className="group-open:hidden">
            ▼
          </span>
          <span aria-hidden="true" className="hidden group-open:inline">
            ▲
          </span>
        </span>
        <span data-testid="checkout-total" className="font-pixel text-[10px] text-yellow">
          {totalLabel(totalCents)}
        </span>
      </summary>
      <div className="pt-3.5">
        <Items lines={lines} size={48} className="gap-2.5 py-1.5 text-[13px]" />
      </div>
    </details>
  );
}

function Row({ label, note, value }: { label: string; note?: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      {note ? <span className="flex-1 text-xs text-text-muted">{note}</span> : null}
      <span className="text-right">{value}</span>
    </div>
  );
}

/** Desktop: the boxed "SEU INVENTÁRIO" aside next to the form. */
export function SummaryAside({ lines, subtotalCents, totalCents, shipping, coupon }: Props) {
  return (
    <aside
      aria-labelledby="inventario"
      className="hidden min-w-0 flex-[1_1_320px] flex-col gap-[18px] border-4 border-text bg-surface-2 p-6 shadow-[10px_10px_0_var(--color-accent)] md:flex"
    >
      <h2 id="inventario" className="m-0 font-pixel text-xs">
        SEU INVENTÁRIO
      </h2>
      <Items lines={lines} size={64} className="gap-3.5 py-2 text-sm" />
      <div className="flex flex-col gap-2.5 border-t-[3px] border-dashed border-border pt-4 text-sm">
        <Row label="Subtotal" value={totalLabel(subtotalCents)} />
        <Row
          label="Frete"
          value={
            shipping ? `${shipping.service} · ${totalLabel(shipping.priceCents)}` : "escolha acima"
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
      <div className="flex items-center justify-between">
        <span className="font-pixel text-xs">TOTAL</span>
        <span data-testid="checkout-total" className="font-pixel text-sm text-yellow">
          {totalLabel(totalCents)}
        </span>
      </div>
    </aside>
  );
}
