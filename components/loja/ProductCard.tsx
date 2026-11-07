import Image from "next/image";
import Link from "next/link";
import { BeadArt } from "@/components/pixel/BeadArt";
import { Badge } from "@/components/ui/Badge";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import type { Product, Rarity } from "@/lib/data/types";
import { priceLabel } from "@/lib/format";
import { FavoriteButton } from "./FavoriteButton";
import { StockAlertButton } from "./StockAlertButton";

const RARITY_LABEL: Record<Rarity, string | null> = {
  epico: "★★★ ÉPICO",
  raro: "★★ RARO",
  comum: null,
};

function ProductVisual({ product }: { product: Product }) {
  const photo = product.images[0];
  if (photo) {
    return (
      <Image
        src={photo.url}
        alt={photo.alt}
        fill
        sizes="(min-width: 768px) 280px, 50vw"
        className="object-cover"
      />
    );
  }
  if (!product.art) return null;
  const { rows, palette, letter, alt } = product.art;
  // Drawn at the desktop size and scaled down on mobile so the 9x9 grid fits a half-width card.
  return (
    <div className="relative scale-[0.68] md:scale-100">
      <BeadArt rows={rows} palette={palette} cell={16} gap={2} label={alt} />
      {letter ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center pb-[30px] font-pixel text-[28px] text-white [text-shadow:2px_2px_0_var(--color-bg)]"
        >
          {letter}
        </span>
      ) : null}
    </div>
  );
}

type Props = {
  product: Product;
  favorite: boolean;
  loggedIn: boolean;
};

/** One catalog card: picture (or bead art), badges, favorite, name, price and action. */
export function ProductCard({ product, favorite, loggedIn }: Props) {
  const soldOut = product.stock === 0;
  const rarity = product.rarity ? RARITY_LABEL[product.rarity] : null;
  const href = `/produto/${product.slug}`;
  const price = (
    <span className="shrink-0 font-pixel text-[9px] whitespace-nowrap text-yellow md:text-[11px]">
      {priceLabel(product.priceCents)}
    </span>
  );

  return (
    <article
      className={cn("flex flex-col border-[3px] border-border bg-surface", soldOut && "opacity-75")}
    >
      <div className="relative">
        <Link
          href={href}
          className={cn(
            "relative flex aspect-square items-center justify-center overflow-hidden bg-deep",
            focusRing,
          )}
        >
          <ProductVisual product={product} />
          <span className="absolute top-2 left-2 flex flex-col items-start gap-1.5 md:top-2.5 md:left-2.5">
            {rarity ? <Badge tone="yellow">{rarity}</Badge> : null}
            {product.isNew ? <Badge tone="green">NOVO</Badge> : null}
            {soldOut ? <Badge tone="muted">ESGOTADO</Badge> : null}
          </span>
        </Link>
        <FavoriteButton productId={product.id} name={product.name} initialFavorite={favorite} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5 md:gap-2.5 md:p-4">
        <h3 className="font-pixel text-[8px] leading-relaxed md:text-[10px]">{product.name}</h3>
        <span className="hidden text-xs text-text-subtle md:block">{product.categoryLabel}</span>
        {soldOut ? (
          <StockAlertButton productId={product.id} loggedIn={loggedIn}>
            {price}
          </StockAlertButton>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-2.5">
            {price}
            <Link
              href={href}
              className={cn(
                "hidden min-h-11 items-center bg-accent px-3 font-pixel text-[8px] text-bg no-underline md:inline-flex",
                focusRing,
              )}
            >
              VER ITEM
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
