import { beforeEach, describe, expect, it } from "vitest";

import type { CatalogPort } from "@/lib/data/ports";
import { productFixtures } from "@/lib/data/mock/fixtures";
import { PAGE_SIZE, type ShopQuery } from "@/lib/shop-query";

import type { ContractEnv } from "./contract-env";
import type { FixtureIds } from "./fixture-ids";

const defaults: ShopQuery = {
  categoria: "todos",
  q: "",
  cores: [],
  disponivel: false,
  ordem: "destaque",
  pagina: 1,
};

const catalogOrder = productFixtures.map((p) => p.slug);

/**
 * Behaviour every CatalogPort adapter must share. `addFiller(n)` adds n extra products (no featured
 * rank) so pagination can be exercised past the 9 fixtures.
 */
export function describeCatalogContract(
  env: ContractEnv<CatalogPort> & { addFiller: (n: number) => Promise<void> },
  ids: FixtureIds,
) {
  describe(`catalog contract (${env.name})`, () => {
    const catalog = env.make();
    const slugs = (r: { items: { slug: string }[] }) => r.items.map((p) => p.slug);

    beforeEach(() => env.reset());

    describe("list", () => {
      it("returns all fixtures on a single page", async () => {
        const r = await catalog.list(defaults);
        expect(r).toMatchObject({ total: 9, page: 1, pageCount: 1 });
        expect(r.items).toHaveLength(9);
        expect(r.items.find((p) => p.slug === "coracao-pixel")?.id).toBe(ids.id("coracao-pixel"));
      });

      it("returns the complete Product shape", async () => {
        const r = await catalog.list({ ...defaults, q: "garota" });
        expect(r.items).toHaveLength(1);
        const fixture = productFixtures.find((p) => p.slug === "garota-pixel")!;
        expect(r.items[0]).toEqual({ ...fixture, id: ids.id("garota-pixel") });
      });

      it("paginates by PAGE_SIZE and clamps out-of-range pages", async () => {
        await env.addFiller(PAGE_SIZE + 3 - productFixtures.length);
        const p1 = await catalog.list(defaults);
        expect(p1.items).toHaveLength(PAGE_SIZE);
        expect(p1.total).toBe(PAGE_SIZE + 3);
        expect(p1.pageCount).toBe(2);
        const p2 = await catalog.list({ ...defaults, pagina: 2 });
        expect(p2.items).toHaveLength(3);
        const p9 = await catalog.list({ ...defaults, pagina: 9 });
        expect(p9.page).toBe(2);
        expect(p9.items).toHaveLength(3);
      });

      it("reports an empty result as one empty page", async () => {
        expect(await catalog.list({ ...defaults, q: "zzz" })).toEqual({
          items: [],
          total: 0,
          page: 1,
          pageCount: 1,
        });
        expect(await catalog.list({ ...defaults, q: "zzz", pagina: 5 })).toEqual({
          items: [],
          total: 0,
          page: 1,
          pageCount: 1,
        });
      });

      it("filters by category", async () => {
        const r = await catalog.list({ ...defaults, categoria: "iniciais" });
        expect(slugs(r)).toEqual(["estrela-numero", "estrela-inicial", "coracao-inicial"]);
        expect(r.total).toBe(3);
      });

      it("filters by colors (any of)", async () => {
        const r = await catalog.list({ ...defaults, cores: ["rosa"] });
        expect(slugs(r)).toEqual([
          "garota-pixel",
          "estrela-inicial",
          "sorvete-pixel",
          "coracao-pixel",
        ]);
        const either = await catalog.list({ ...defaults, cores: ["roxo", "verde"] });
        expect(slugs(either)).toEqual(["planeta-pixel", "cacto-pixel"]);
      });

      it("filters by availability", async () => {
        const r = await catalog.list({ ...defaults, disponivel: true });
        expect(r.total).toBe(8);
        expect(slugs(r)).not.toContain("planeta-pixel");
      });

      it("combines filters", async () => {
        expect((await catalog.list({ ...defaults, cores: ["roxo"], disponivel: true })).total).toBe(
          0,
        );
        const r = await catalog.list({ ...defaults, categoria: "icones", cores: ["rosa"] });
        expect(slugs(r)).toEqual(["sorvete-pixel", "coracao-pixel"]);
      });

      it("orders by featured rank by default", async () => {
        expect(slugs(await catalog.list(defaults))).toEqual(catalogOrder);
      });

      it("orders new products first, keeping catalog order among ties", async () => {
        const r = await catalog.list({ ...defaults, ordem: "novo" });
        expect(slugs(r)).toEqual([
          "sorvete-pixel",
          "gatinho-pixel",
          ...catalogOrder.filter((s) => s !== "sorvete-pixel" && s !== "gatinho-pixel"),
        ]);
      });

      it("orders by price (all null: catalog order) in both directions", async () => {
        expect(slugs(await catalog.list({ ...defaults, ordem: "menor" }))).toEqual(catalogOrder);
        expect(slugs(await catalog.list({ ...defaults, ordem: "maior" }))).toEqual(catalogOrder);
      });
    });

    describe("search", () => {
      it("ignores case and accents", async () => {
        const a = await catalog.list({ ...defaults, q: "coração" });
        const b = await catalog.list({ ...defaults, q: "CORACAO" });
        expect(slugs(a)).toEqual(["coracao-pixel", "coracao-inicial"]);
        expect(b).toEqual(a);
      });

      it("treats wildcards and SQL as plain text", async () => {
        for (const q of ["100%", "a_b", "'; drop table products; --", "\\"]) {
          const r = await catalog.list({ ...defaults, q });
          expect(r).toEqual({ items: [], total: 0, page: 1, pageCount: 1 });
        }
        expect((await catalog.list(defaults)).total).toBe(9);
      });
    });

    describe("lookups", () => {
      it("bySlug returns null for unknown slugs", async () => {
        expect(await catalog.bySlug("inexistente")).toBeNull();
      });

      it("bySlug returns the full product", async () => {
        const p = await catalog.bySlug("garota-pixel");
        const fixture = productFixtures.find((f) => f.slug === "garota-pixel")!;
        expect(p).toEqual({ ...fixture, id: ids.id("garota-pixel") });
      });

      it("related puts the same category first, excludes itself and respects limit", async () => {
        const self = ids.id("coracao-pixel");
        const r = await catalog.related(self, 4);
        expect(r).toHaveLength(4);
        expect(r.some((p) => p.id === self)).toBe(false);
        expect(r.every((p) => p.categories.includes("icones"))).toBe(true);
        const wide = await catalog.related(self, 8);
        expect(wide).toHaveLength(8);
        expect(wide[0].categories).toContain("icones");
        expect(slugs({ items: wide })).toEqual([
          "sorvete-pixel",
          "planeta-pixel",
          "cacto-pixel",
          "coracao-inicial",
          "garota-pixel",
          "estrela-numero",
          "estrela-inicial",
          "gatinho-pixel",
        ]);
      });

      it("related returns nothing for an unknown product or a zero limit", async () => {
        expect(await catalog.related(ids.unknown, 4)).toEqual([]);
        expect(await catalog.related("not-an-id", 4)).toEqual([]);
        expect(await catalog.related(ids.id("coracao-pixel"), 0)).toEqual([]);
      });

      it("featured is ordered by rank", async () => {
        const r = await catalog.featured(3);
        expect(r.map((p) => p.slug)).toEqual(["garota-pixel", "estrela-numero", "estrela-inicial"]);
        expect(await catalog.featured(0)).toEqual([]);
      });

      it("byIds keeps the requested order and ignores unknown ids", async () => {
        const r = await catalog.byIds([
          ids.id("cacto-pixel"),
          ids.unknown,
          "not-an-id",
          ids.id("garota-pixel"),
        ]);
        expect(r.map((p) => p.slug)).toEqual(["cacto-pixel", "garota-pixel"]);
        expect(await catalog.byIds([])).toEqual([]);
      });
    });
  });
}
