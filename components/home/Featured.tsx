import Image from "next/image";
import Link from "next/link";
import { BeadArt } from "@/components/pixel/BeadArt";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { getData } from "@/lib/data";
import { priceLabel } from "@/lib/format";
import type { Product, Rarity } from "@/lib/data/types";

const RARITY: Record<Rarity, { label: string; bar: number }> = {
  epico: { label: "★★★ ÉPICO", bar: 90 },
  raro: { label: "★★ RARO", bar: 60 },
  comum: { label: "★ COMUM", bar: 30 },
};

function ProductVisual({ product }: { product: Product }) {
  const photo = product.images[0];
  if (photo) {
    return (
      <Image
        src={photo.url}
        alt={photo.alt}
        fill
        sizes="(min-width: 768px) 360px, 240px"
        className="object-cover"
      />
    );
  }
  if (product.art) {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-surface-2">
        <BeadArt
          rows={product.art.rows}
          palette={product.art.palette}
          cell={22}
          gap={2}
          label={product.art.alt}
        />
      </span>
    );
  }
  return null;
}

function FeaturedCard({ product }: { product: Product }) {
  const rarity = product.rarity ? RARITY[product.rarity] : null;
  return (
    <article className="h-full border-[3px] border-border bg-surface">
      <Link
        href={`/produto/${product.slug}`}
        className={cn("flex h-full flex-col text-text no-underline", focusRing)}
      >
        <span className="relative block h-[240px] md:h-[300px]">
          <ProductVisual product={product} />
          {rarity ? (
            <span className="absolute top-2.5 left-2.5 bg-bg px-2 py-1.5 font-pixel text-[7px] text-yellow md:top-3 md:left-3 md:px-2.5 md:py-2 md:text-[8px]">
              {rarity.label}
            </span>
          ) : null}
        </span>
        <span className="flex flex-1 flex-col gap-2.5 p-3.5 md:gap-3.5 md:p-5">
          <h3 className="font-pixel text-[10px] leading-normal md:text-xs md:leading-relaxed">
            {product.name}
          </h3>
          <span className="hidden text-sm leading-normal text-text-muted md:block">
            {product.description}
          </span>
          <span className="hidden items-center gap-2 text-xs text-text-subtle md:flex">
            CONTAS
            <span aria-hidden="true" className="h-2.5 flex-1 bg-surface-2">
              <span
                className="block h-2.5 bg-yellow"
                style={{ width: `${rarity?.bar ?? RARITY.comum.bar}%` }}
              />
            </span>
          </span>
          <span className="mt-auto flex items-center justify-between gap-3">
            <span className="font-pixel text-[10px] text-yellow md:text-[13px]">
              {priceLabel(product.priceCents)}
            </span>
            <span
              aria-hidden="true"
              className="hidden bg-accent px-3.5 py-4 font-pixel text-[9px] text-bg md:inline-block"
            >
              VER ITEM
            </span>
          </span>
        </span>
      </Link>
    </article>
  );
}

/** "SELECIONE SEU ITEM": the 3 featured products. Scroll-snap carousel on mobile, grid from md. */
export async function Featured() {
  const products = await getData().catalog.featured(3);
  return (
    <section
      id="loja"
      aria-labelledby="loja-title"
      data-parallax="featured"
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 py-10 pl-4 md:gap-10 md:px-6 md:py-24"
    >
      <div className="flex items-center justify-between gap-4 pr-4 md:items-end md:pr-0">
        <h2
          id="loja-title"
          className="font-pixel text-sm leading-normal text-text md:text-2xl md:leading-normal"
        >
          SELECIONE <br className="md:hidden" />
          SEU ITEM
        </h2>
        <Link
          href="/loja"
          className={cn(
            "inline-flex min-h-11 items-center font-pixel text-[9px] text-link underline-offset-4 hover:text-yellow hover:underline md:bg-yellow md:px-3.5 md:text-bg md:no-underline md:hover:text-bg",
            focusRing,
          )}
        >
          VER TODOS ›
        </Link>
      </div>
      <ul className="m-0 -ml-2 flex snap-x snap-mandatory scroll-pl-2 [scrollbar-width:none] list-none gap-3.5 overflow-x-auto pt-2 pr-4 pb-3 pl-2 md:ml-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:gap-7 md:overflow-visible md:p-0 [&::-webkit-scrollbar]:hidden">
        {products.map((product) => (
          <li key={product.id} className="w-[240px] flex-none snap-start md:w-auto">
            <FeaturedCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
