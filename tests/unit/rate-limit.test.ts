import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClientIp } = vi.hoisted(() => ({ getClientIp: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/client-ip", () => ({ getClientIp }));

import { getMockStore } from "@/lib/data/mock/store";
import { allowAttempt, RATE_LIMITED, RATE_LIMITS } from "@/lib/rate-limit";

beforeEach(() => {
  getMockStore().reset();
  getClientIp.mockReset();
  getClientIp.mockResolvedValue("203.0.113.9");
});

describe("allowAttempt", () => {
  it("consumes the IP key and the normalized e-mail key", async () => {
    expect(await allowAttempt("login", "  Ana@Teste.DEV ")).toBe(true);
    expect(Object.keys(getMockStore().rateLimits).sort()).toEqual([
      "email:login:ana@teste.dev",
      "ip:login:203.0.113.9",
    ]);
  });

  it("without an IP, consumes only the e-mail key", async () => {
    getClientIp.mockResolvedValue(null);
    expect(await allowAttempt("cadastro", "ana@teste.dev")).toBe(true);
    expect(Object.keys(getMockStore().rateLimits)).toEqual(["email:cadastro:ana@teste.dev"]);
  });

  it("without an e-mail, consumes only the IP key", async () => {
    expect(await allowAttempt("newsletter", null)).toBe(true);
    expect(Object.keys(getMockStore().rateLimits)).toEqual(["ip:newsletter:203.0.113.9"]);
  });

  it("refuses the 6th attempt with the same e-mail in the window", async () => {
    for (let i = 0; i < RATE_LIMITS.perEmail.max; i++) {
      expect(await allowAttempt("login", "ana@teste.dev")).toBe(true);
    }
    expect(await allowAttempt("login", "ana@teste.dev")).toBe(false);
    // Other actions and e-mails have their own counters.
    expect(await allowAttempt("login", "bruno@teste.dev")).toBe(true);
    expect(await allowAttempt("reenvio", "ana@teste.dev")).toBe(true);
  });

  it("refuses the 21st attempt from the same IP, whatever the e-mail", async () => {
    for (let i = 0; i < RATE_LIMITS.perIp.max; i++) {
      expect(await allowAttempt("login", `p${i}@teste.dev`)).toBe(true);
    }
    expect(await allowAttempt("login", "outra@teste.dev")).toBe(false);
  });

  it("uses the limits and message of the spec", () => {
    expect(RATE_LIMITS).toEqual({
      perEmail: { max: 5, windowSeconds: 900 },
      perIp: { max: 20, windowSeconds: 900 },
    });
    expect(RATE_LIMITED).toBe("Muitas tentativas. Tente de novo em alguns minutos.");
  });
});
