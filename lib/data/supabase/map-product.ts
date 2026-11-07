import type { BeadArtSpec, CategoryId, ColorId, Product, ProductImage } from "@/lib/data/types";
import type { Tables } from "@/lib/supabase/database.types";

export type ProductRow = Tables<"products">;

/** Table row (snake_case) -> Product. The `search_products` RPC already returns the Product shape. */
export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    rarity: row.rarity as Product["rarity"],
    isNew: row.is_new,
    stock: row.stock,
    categories: row.categories as CategoryId[],
    categoryLabel: row.category_label,
    colors: row.colors as ColorId[],
    images: row.images as ProductImage[],
    art: row.art as BeadArtSpec | null,
    illustrative: row.illustrative,
    sizeCm: row.size_cm,
    beadCount: row.bead_count,
    cuteness: "MAX",
    options: row.options as Product["options"],
    featuredRank: row.featured_rank,
  };
}
