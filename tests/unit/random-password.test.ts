import { describe, expect, it } from "vitest";

import { randomPassword } from "@/lib/data/supabase/random-password";

describe("randomPassword", () => {
  it("always has upper, lower, digit and symbol, and is long", () => {
    for (let i = 0; i < 200; i++) {
      const p = randomPassword();
      expect(p.length).toBeGreaterThanOrEqual(40);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it("is different every time", () => {
    expect(new Set(Array.from({ length: 50 }, randomPassword)).size).toBe(50);
  });
});
