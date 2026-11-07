import { beforeEach, describe, expect, it } from "vitest";

import type { EngagementPort } from "@/lib/data/ports";

import type { ContractEnv } from "./contract-env";
import type { FixtureIds } from "./fixture-ids";

export type EngagementContractEnv = Omit<ContractEnv<EngagementPort>, "make"> & {
  /** Two distinct users the adapter can act for. */
  users: [string, string];
  /** A port acting as `userId` (a signed-in session for real adapters). */
  forUser: (userId: string) => EngagementPort;
  /** Pending stock alerts stored for this e-mail and product. */
  alertCount: (email: string, productId: string) => Promise<number>;
};

export function describeEngagementContract(env: EngagementContractEnv, ids: FixtureIds) {
  describe(`engagement contract (${env.name})`, () => {
    const [ana, other] = env.users;
    const garota = ids.id("garota-pixel");
    const mario = ids.id("gatinho-pixel");

    beforeEach(env.reset);

    it("toggleFavorite flips and favorites() lists only the owner's", async () => {
      const a = env.forUser(ana);
      expect(await a.toggleFavorite(ana, garota)).toBe(true);
      expect(await a.toggleFavorite(ana, mario)).toBe(true);
      expect(new Set(await a.favorites(ana))).toEqual(new Set([garota, mario]));
      expect(await env.forUser(other).favorites(other)).toEqual([]);

      expect(await a.toggleFavorite(ana, garota)).toBe(false);
      expect(await a.favorites(ana)).toEqual([mario]);
    });

    it("requestStockAlert does not duplicate across case and spaces", async () => {
      const a = env.forUser(ana);
      const consentedAt = new Date().toISOString();
      const base = { userId: ana, productId: garota, consentedAt };
      await a.requestStockAlert({ ...base, email: " Ana@Teste.dev " });
      await a.requestStockAlert({ ...base, email: "ana@teste.dev" });
      expect(await env.alertCount("ana@teste.dev", garota)).toBe(1);
    });
  });
}
