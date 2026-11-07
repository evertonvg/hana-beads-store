import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import type { CatalogPort } from "@/lib/data/ports";
import type { Product } from "@/lib/data/types";
import { PAGE_SIZE, type ShopQuery } from "@/lib/shop-query";
import type { Database } from "@/lib/supabase/database.types";
import { createSupabasePublicClient } from "@/lib/supabase/public";

import { toPortError } from "./errors";
import { mapProduct } from "./map-product";

export const CATALOG_TAG = "catalog";
export const productTag = (slug: string) => `product:${slug}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The query code, uncached. Contract tests run this against a real database; the `'use cache'`
 * layer below only adds caching (those directives need the Next runtime: `cacheTag` throws outside it).
 */
export function createSupabaseCatalog(deps: {
  getClient: () => SupabaseClient<Database>;
}): CatalogPort {
  const products = () => deps.getClient().from("products");

  return {
    async list(q) {
      const { data, error } = await deps.getClient().rpc("search_products", {
        p_categoria: q.categoria,
        p_q: q.q,
        p_cores: q.cores,
        p_disponivel: q.disponivel,
        p_ordem: q.ordem,
        p_pagina: q.pagina,
        p_page_size: PAGE_SIZE,
      });
      if (error) toPortError(error);
      // The RPC returns no rows at all for an empty result, and clamps the page itself.
      const total = data.length === 0 ? 0 : Number(data[0].total);
      const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const page = Math.min(Math.max(1, q.pagina), pageCount);
      return { items: data.map((r) => r.item as unknown as Product), total, page, pageCount };
    },

    async bySlug(slug) {
      const { data, error } = await products().select("*").eq("slug", slug).maybeSingle();
      if (error) toPortError(error);
      return data ? mapProduct(data) : null;
    },

    async related(productId, limit) {
      const n = Math.max(0, limit);
      if (n === 0 || !UUID.test(productId)) return [];
      const current = await products().select("categories").eq("id", productId).maybeSingle();
      if (current.error) toPortError(current.error);
      if (!current.data) return [];
      const { categories } = current.data;
      // same-category products first, then the rest, both in catalog order
      const same = await products()
        .select("*")
        .neq("id", productId)
        .overlaps("categories", categories)
        .order("created_at")
        .order("id")
        .limit(n);
      if (same.error) toPortError(same.error);
      const rows = same.data;
      if (rows.length < n) {
        const rest = await products()
          .select("*")
          .neq("id", productId)
          .not("categories", "ov", `{${categories.join(",")}}`)
          .order("created_at")
          .order("id")
          .limit(n - rows.length);
        if (rest.error) toPortError(rest.error);
        rows.push(...rest.data);
      }
      return rows.map(mapProduct);
    },

    async featured(limit) {
      const n = Math.max(0, limit);
      if (n === 0) return [];
      const { data, error } = await products()
        .select("*")
        .not("featured_rank", "is", null)
        .order("featured_rank", { ascending: true })
        .limit(n);
      if (error) toPortError(error);
      return data.map(mapProduct);
    },

    async byIds(ids) {
      const valid = ids.filter((id) => UUID.test(id));
      if (valid.length === 0) return [];
      const { data, error } = await products().select("*").in("id", valid);
      if (error) toPortError(error);
      const byId = new Map(data.map((r) => [r.id, mapProduct(r)]));
      // keep the requested order, drop unknown ids
      return valid.flatMap((id) => byId.get(id) ?? []);
    },
  };
}

const core = () => createSupabaseCatalog({ getClient: createSupabasePublicClient });

async function cachedList(q: ShopQuery) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return core().list(q);
}

async function cachedBySlug(slug: string) {
  "use cache";
  cacheTag(CATALOG_TAG, productTag(slug));
  cacheLife("hours");
  return core().bySlug(slug);
}

async function cachedRelated(productId: string, limit: number) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return core().related(productId, limit);
}

async function cachedFeatured(limit: number) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return core().featured(limit);
}

async function cachedByIds(ids: string[]) {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");
  return core().byIds(ids);
}

/** Production catalog: the same queries, cached and tagged for on-demand revalidation. */
export function createCachedSupabaseCatalog(): CatalogPort {
  return {
    list: cachedList,
    bySlug: cachedBySlug,
    related: cachedRelated,
    featured: cachedFeatured,
    byIds: cachedByIds,
  };
}
