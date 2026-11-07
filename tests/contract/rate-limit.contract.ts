import { beforeEach, describe, expect, it } from "vitest";

import type { RateLimitPort } from "@/lib/data/ports";

import type { ContractEnv } from "./contract-env";

export function describeRateLimitContract(env: ContractEnv<RateLimitPort>) {
  describe(`rate limit contract (${env.name})`, () => {
    beforeEach(env.reset);

    it("allows up to max hits per key, then refuses; keys are independent", async () => {
      const rl = env.make();
      const a = `contract:${crypto.randomUUID()}`;
      const b = `contract:${crypto.randomUUID()}`;
      expect(await rl.hit(a, 2, 3600)).toBe(true);
      expect(await rl.hit(a, 2, 3600)).toBe(true);
      expect(await rl.hit(a, 2, 3600)).toBe(false);
      expect(await rl.hit(b, 2, 3600)).toBe(true);
    });
  });
}
