import { describe, expect, it } from "vitest";
import { applyRememberPolicy, REMEMBER_MAX_AGE } from "@/lib/supabase/remember";

describe("applyRememberPolicy", () => {
  it("drops maxAge and expires without remember, keeping the rest", () => {
    const out = applyRememberPolicy({ maxAge: 400 * 86400, expires: new Date(), path: "/" }, false);
    expect(out).not.toHaveProperty("maxAge");
    expect(out).not.toHaveProperty("expires");
    expect(out.path).toBe("/");
  });

  it("sets 30 days with remember", () => {
    const out = applyRememberPolicy({ maxAge: 400 * 86400, path: "/" }, true);
    expect(out.maxAge).toBe(2_592_000);
    expect(REMEMBER_MAX_AGE).toBe(2_592_000);
  });

  it.each([true, false])("keeps cookie deletions unchanged (remember=%s)", (remember) => {
    expect(applyRememberPolicy({ maxAge: 0, path: "/" }, remember)).toEqual({
      maxAge: 0,
      path: "/",
    });
    const past = new Date(0);
    expect(applyRememberPolicy({ expires: past, path: "/" }, remember).expires).toBe(past);
  });
});
