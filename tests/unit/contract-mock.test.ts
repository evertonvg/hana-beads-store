import { beforeEach, describe, expect, it } from "vitest";

import { createMockEngagement } from "@/lib/data/mock/engagement";
import { createMockNewsletter } from "@/lib/data/mock/newsletter";
import { createMockRateLimit } from "@/lib/data/mock/rate-limit";
import { createMockCatalog } from "@/lib/data/mock/catalog";
import { productFixtures } from "@/lib/data/mock/fixtures";
import { getMockStore } from "@/lib/data/mock/store";

import { describeAuthContract } from "../contract/auth.contract";
import { describeCatalogContract } from "../contract/catalog.contract";
import { describeEngagementContract } from "../contract/engagement.contract";
import { describeNewsletterContract } from "../contract/newsletter.contract";
import { describeRateLimitContract } from "../contract/rate-limit.contract";
import type { FixtureIds } from "../contract/fixture-ids";
import { mockAuthInJar } from "./memory-cookies";

// The mock uses the fixtures' own string ids.
const mockIds: FixtureIds = {
  id: (slug) => {
    const p = productFixtures.find((f) => f.slug === slug);
    if (!p) throw new Error(`unknown fixture slug ${slug}`);
    return p.id;
  },
  unknown: "nope",
};

describeCatalogContract(
  {
    name: "mock",
    make: createMockCatalog,
    reset: () => {
      getMockStore().reset();
      return Promise.resolve();
    },
    setPrices: (prices) => {
      for (const p of getMockStore().products) {
        if (p.slug in prices) p.priceCents = prices[p.slug];
      }
      return Promise.resolve();
    },
    addFiller: (n) => {
      const store = getMockStore();
      store.products.push(
        ...Array.from({ length: n }, (_, i) => ({
          ...structuredClone(productFixtures[0]),
          id: `filler-${i}`,
          slug: `filler-${String(i).padStart(2, "0")}`,
          name: `FILLER ${String(i).padStart(2, "0")}`,
          featuredRank: null,
        })),
      );
      return Promise.resolve();
    },
  },
  mockIds,
);

describeAuthContract({
  name: "mock",
  reset: () => {
    getMockStore().reset();
    return Promise.resolve();
  },
  readInbox: (email) =>
    Promise.resolve(
      getMockStore()
        .inbox.filter((m) => m.to === email)
        .map(({ kind, link }) => ({ kind, link })),
    ),
  withSession: (fn) => fn(mockAuthInJar()),
});

const resetMock = () => {
  getMockStore().reset();
  return Promise.resolve();
};

describeEngagementContract(
  {
    name: "mock",
    reset: resetMock,
    users: ["a0000000-0000-4000-8000-000000000002", "a0000000-0000-4000-8000-000000000001"],
    forUser: () => createMockEngagement(),
    alertCount: (email, productId) =>
      Promise.resolve(
        getMockStore().stockAlerts.filter((a) => a.email === email && a.productId === productId)
          .length,
      ),
  },
  mockIds,
);
describeNewsletterContract({ name: "mock", make: createMockNewsletter, reset: resetMock });
describeRateLimitContract({ name: "mock", make: createMockRateLimit, reset: resetMock });

describe("fixtures", () => {
  it("has 9 products, all without price, 3 with photos", () => {
    expect(productFixtures).toHaveLength(9);
    expect(productFixtures.every((p) => p.priceCents === null)).toBe(true);
    expect(productFixtures.filter((p) => !p.illustrative)).toHaveLength(3);
    expect(productFixtures.find((p) => p.slug === "planeta-pixel")?.stock).toBe(0);
  });

  it("illustrative <=> no images, with art and alt", () => {
    for (const p of productFixtures) {
      expect(p.illustrative).toBe(p.images.length === 0);
      expect(p.images.filter((i) => i.url === "")).toEqual([]);
      expect(!p.illustrative || (p.art?.alt.length ?? 0) > 0).toBe(true);
    }
  });
});

describe("mock store", () => {
  beforeEach(() => getMockStore().reset());

  it("does not share arrays between products after reset", () => {
    const store = getMockStore();
    store.products[0]?.options.push({ type: "argola", value: "estrela", priceDeltaCents: 1 });
    expect(store.products[1]?.options).toEqual([]);
    store.reset();
    expect(store.products[0]?.options).toEqual([]);
  });

  it("reset discards mutations", async () => {
    getMockStore().products[0].stock = 99;
    getMockStore().reset();
    expect((await createMockCatalog().bySlug("garota-pixel"))?.stock).toBe(5);
    expect(productFixtures[0].stock).toBe(5);
  });
});
