import Image from "next/image";
import Link from "next/link";
import { BeadArt } from "@/components/pixel/BeadArt";
import { focusRing } from "@/components/ui/focus";
import { cn } from "@/lib/cn";
import { getData } from "@/lib/data";
import type { Product } from "@/lib/data/types";
import { priceLabel } from "@/lib/format";

function Visual({ product }: { product: Product }) {
  const photo = product.images[0];
  if (photo) {
    return (
      <Image
        src={photo.url}
        alt={photo.alt}
        fill
        sizes="(min-width: 768px) 280px, 100vw"
        className="object-cover"
      />
    );
  }
  if (!product.art) return null;
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-surface-2">
      <BeadArt
        rows={product.art.rows}
        palette={product.art.palette}
        cell={16}
        gap={2}
        label={product.art.alt}
      />
    </span>
  );
}

/** "COMECE POR AQUI": three featured products for an empty cart. */
export async function CartSuggestions() {
  const products = await getData().catalog.featured(3);
  return (
    <section
      aria-labelledby="comece-por-aqui"
      className="flex flex-col gap-6 border-t-4 border-border-soft pt-10"
    >
      <h2 id="comece-por-aqui" className="m-0 font-pixel text-sm leading-normal">
        COMECE POR <span className="text-accent">AQUI</span>
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] md:gap-[22px]">
        {products.map((product) => (
          <li key={product.id} className="flex">
            <Link
              href={`/produto/${product.slug}`}
              className={cn(
                "flex w-full flex-col border-[3px] border-border bg-surface text-text no-underline",
                focusRing,
              )}
            >
              <span className="relative block h-[220px] bg-deep">
                <Visual product={product} />
              </span>
              <span className="flex justify-between gap-3 p-4 font-pixel text-[10px] leading-relaxed">
                <span>{product.name}</span>
                <span className="text-yellow">{priceLabel(product.priceCents)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
