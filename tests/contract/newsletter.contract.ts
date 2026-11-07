import { beforeEach, describe, expect, it } from "vitest";

import type { NewsletterPort } from "@/lib/data/ports";

import type { ContractEnv } from "./contract-env";

export function describeNewsletterContract(env: ContractEnv<NewsletterPort>) {
  describe(`newsletter contract (${env.name})`, () => {
    beforeEach(env.reset);

    it("first subscription is ok, later ones (any case or spaces) are already", async () => {
      const news = env.make();
      const base = { consent: true as const, consentVersion: "2026-10-28" };
      expect(await news.subscribe({ ...base, email: "nova@teste.dev" })).toEqual({ status: "ok" });
      expect(await news.subscribe({ ...base, email: " Nova@Teste.dev " })).toEqual({
        status: "already",
      });
      expect(await news.subscribe({ ...base, email: "nova@teste.dev" })).toEqual({
        status: "already",
      });
    });
  });
}
