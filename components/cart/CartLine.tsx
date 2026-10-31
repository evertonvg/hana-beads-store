"use client";

import Image from "next/image";
import { BeadArt } from "@/components/pixel/BeadArt";
import { RING_NAME } from "@/components/loja/ring";
import { focusRing } from "@/components/ui/focus";
import { Icon } from "@/components/ui/Icon";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { cn } from "@/lib/cn";
import type { PricedLine } from "@/lib/cart/totals";
import { lineKey } from "@/lib/cart/types";
import type { Rarity } from "@/lib/data/types";
import { priceLabel } from "@/lib/format";

const RARITY_LABEL: Record<Rarity, string | null> = {
  epico: "★★★ ÉPICO",
  raro: "★★ RARO",
  comum: null,
};

function LineImage({ line }: { line: PricedLine }) {
  const { product } = line;
  const photo = product.images[0];
  return (
    <div className="flex size-[92px] shrink-0 items-center justify-center self-start overflow-hidden border-2 border-text bg-deep md:size-[120px] md:self-center md:border-[3px]">
      {photo ? (
        <Image
          src={photo.url}
          alt={photo.alt}
          width={120}
          height={120}
          className="size-full object-cover"
        />
      ) : product.art ? (
        <BeadArt
          rows={product.art.rows}
          palette={product.art.palette}
          cell={8}
          gap={1}
          label={product.art.alt}
        />
      ) : null}
    </div>
  );
}

type Props = {
  line: PricedLine;
  onQty: (qty: number) => void;
  onRemove: () => void;
};

/** One cart line: picture, name, rarity, ring, quantity stepper, amount and remove. */
export function CartLine({ line, onQty, onRemove }: Props) {
  const { product } = line;
  const rarity = product.rarity ? RARITY_LABEL[product.rarity] : null;
  return (
    <li className="relative flex gap-3 border-[3px] border-border bg-surface p-3 md:flex-wrap md:items-center md:gap-5 md:p-4">
      <LineImage line={line} />
      {/* Below md this is a column; from md up its children join the row of the <li>. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:contents">
        <div className="flex min-w-0 flex-col gap-2 max-md:pr-12 md:flex-[1_1_200px] md:gap-2.5">
          {rarity ? (
            <span className="font-pixel text-[7px] text-yellow md:text-[8px]">{rarity}</span>
          ) : null}
          <h2 className="m-0 font-pixel text-[9px] leading-relaxed break-words md:text-[13px] md:leading-normal">
            {product.name}
          </h2>
          <p className="m-0 text-xs text-text-muted md:text-[13px]">
            Argola: {RING_NAME[line.ring]}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 md:contents">
          <QuantityStepper
            value={line.qty}
            onChange={onQty}
            label={`Quantidade de ${product.name}`}
          />
          <div className="flex flex-col items-end gap-2.5 md:min-w-[120px]">
            <span className="font-pixel text-[9px] text-yellow md:text-[11px]">
              {priceLabel(line.lineCents)}
            </span>
            <button
              type="button"
              aria-label={`Remover ${product.name}`}
              data-focus-key={lineKey(line)}
              onClick={onRemove}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center text-text-muted",
                "max-md:absolute max-md:top-3 max-md:right-3 max-md:size-11 max-md:border-2 max-md:border-border",
                "md:text-[13px] md:underline md:underline-offset-4",
                focusRing,
              )}
            >
              <Icon name="trash" size={16} className="md:hidden" />
              <span className="max-md:sr-only" aria-hidden="true">
                Remover
              </span>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
