"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BeadArt } from "@/components/pixel/BeadArt";
import { FreeShippingBar } from "@/components/cart/FreeShippingBar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Drawer } from "@/components/ui/Drawer";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useCartPrices } from "@/components/cart/use-cart-prices";
import { useCartStore } from "@/lib/cart/store";
import { unitCents } from "@/lib/cart/price";
import { computeTotals, type PricedLine } from "@/lib/cart/totals";
import { lineKey } from "@/lib/cart/types";
import type { Product, RingOption } from "@/lib/data/types";
import { totalLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { RING_NAME } from "./ring";

export type LastAdded = { product: Product; ring: RingOption; qty: number };

type Props = { open: boolean; onClose: () => void; lastAdded: LastAdded };

function Thumb({ product, highlight }: { product: Product | null; highlight: boolean }) {
  const photo = product?.images[0];
  return (
    <div
      className={cn(
        "flex size-16 shrink-0 items-center justify-center overflow-hidden border-2 bg-deep md:size-[72px]",
        highlight ? "border-text" : "border-border",
      )}
    >
      {photo ? (
        <Image
          src={photo.url}
          alt={photo.alt}
          width={72}
          height={72}
          className="size-full object-cover"
        />
      ) : product?.art ? (
        <BeadArt
          rows={product.art.rows}
          palette={product.art.palette}
          cell={6}
          gap={1}
          label={product.art.alt}
        />
      ) : null}
    </div>
  );
}

const ARM_DELAY_MS = 400;

const actionClass = "w-full";

/** "ITEM COLETADO!": side drawer on desktop, bottom sheet on mobile. */
export function CartDrawer({ open, onClose, lastAdded }: Props) {
  const desktop = useMediaQuery("(min-width: 768px)");
  // A fast double click on "+ PEGAR ITEM" lands its second click where the drawer now is. For a
  // moment the panel ignores the pointer and the backdrop does not dismiss it; Escape always does.
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  useEffect(() => {
    const arm = () => {
      armedRef.current = true;
      setArmed(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") arm();
    };
    const t = setTimeout(arm, ARM_DELAY_MS);
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);
  const dismiss = () => {
    if (armedRef.current) onClose();
  };
  const lines = useCartStore((s) => s.lines);
  const itemCount = useCartStore((s) => s.count());
  const { product, ring, qty } = lastAdded;
  const addedKey = lineKey({ productId: product.id, ring });

  // The product of this page is known at once; the others come from the shared cart price query.
  const { priced } = useCartPrices();
  const rows = lines.map((l) => {
    const other = priced.find((p) => lineKey(p) === lineKey(l));
    const known = l.productId === product.id ? product : (other?.product ?? null);
    const unit = known ? unitCents(known, l.ring) : null;
    return { line: l, product: known, lineCents: unit === null ? null : unit * l.qty, unit };
  });
  const allKnown = rows.every((r) => r.product !== null);
  const pricedLines: PricedLine[] = rows.flatMap((r) =>
    r.product ? [{ ...r.line, product: r.product, unitCents: r.unit, lineCents: r.lineCents }] : [],
  );
  const subtotal = allKnown ? computeTotals(pricedLines, 0, 0).subtotalCents : null;

  const body = (
    <div className={cn("flex min-h-full flex-col gap-4", !armed && "pointer-events-none")}>
      <ul aria-label="Itens no carrinho" className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map(({ line, product: lineProduct, lineCents }) => {
          const highlight = lineKey(line) === addedKey;
          return (
            <li
              key={lineKey(line)}
              className={cn(
                "flex items-center gap-3 border-[3px] p-2.5 md:gap-3.5 md:p-3",
                highlight ? "border-accent bg-surface-2" : "border-border",
              )}
            >
              <Thumb product={lineProduct} highlight={highlight} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="font-pixel text-[9px] leading-normal break-words md:text-[10px]">
                  {lineProduct ? lineProduct.name : "…"}
                </span>
                <span className="text-xs text-text-muted">
                  Argola: {RING_NAME[line.ring]} · <span>×{line.qty}</span>
                </span>
              </div>
              <span className="font-pixel text-[9px] text-yellow">{totalLabel(lineCents)}</span>
            </li>
          );
        })}
      </ul>
      <FreeShippingBar subtotalCents={subtotal} />
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-pixel text-[9px] md:text-[10px]">
            SUBTOTAL · {itemCount} {itemCount === 1 ? "ITEM" : "ITENS"}
          </span>
          <span className="font-pixel text-[11px] text-yellow md:text-xs">
            {totalLabel(subtotal)}
          </span>
        </div>
        <Link
          href="/checkout"
          className={cn(
            buttonVariants({ variant: "primary" }),
            actionClass,
            "shadow-[4px_4px_0_var(--color-yellow)]",
          )}
        >
          FINALIZAR COMPRA ›
        </Link>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-1 md:gap-3">
          <Button href="/carrinho" variant="secondary" className="px-1.5 text-[9px] md:text-[10px]">
            VER CARRINHO
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            className="px-1.5 text-[9px] max-md:border-border md:border-0 md:text-[10px] md:text-link md:underline md:underline-offset-4"
          >
            ‹ CONTINUAR JOGANDO
          </Button>
        </div>
      </div>
    </div>
  );

  const title = (
    <>
      ITEM <span className="text-accent">COLETADO!</span>
    </>
  );
  const eyebrow = `+${qty} NO INVENTÁRIO`;

  return desktop ? (
    <Drawer open={open} onClose={dismiss} title={title} eyebrow={eyebrow}>
      {body}
    </Drawer>
  ) : (
    <BottomSheet open={open} onClose={dismiss} title={title} eyebrow={eyebrow}>
      {body}
    </BottomSheet>
  );
}
