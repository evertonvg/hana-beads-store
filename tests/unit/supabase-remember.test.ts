import { describe, expect, it } from "vitest";
import {
  applyRememberPolicy,
  isRemembered,
  REMEMBER_COOKIE,
  REMEMBER_MAX_AGE,
} from "@/lib/supabase/remember";

/** A cookie store as `cookies()` / `request.cookies` expose it, holding `jar`. */
const store = (jar: Record<string, string>) => ({
  get: (name: string) => (name in jar ? { name, value: jar[name] } : undefined),
});

describe("applyRememberPolicy", () => {
  it("drops maxAge and expires without remember, keeping the rest", () => {
    const out = applyRememberPolicy(
      { maxAge: 400 * 86400, expires: new Date(Date.now() + 86_400_000), path: "/" },
      false,
    );
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

describe("isRemembered", () => {
  it("is true only while pp_remember holds the opt-in value", () => {
    expect(isRemembered(store({ [REMEMBER_COOKIE]: "1" }))).toBe(true);
    expect(isRemembered(store({}))).toBe(false);
  });

  // A server action that just cleared the choice (set "" with maxAge 0) still sees the cookie in
  // its own store: presence alone would hand a 30-day session to "manter conectado" unchecked.
  it("is false for the empty value left by clearing the choice in the same request", () => {
    expect(isRemembered(store({ [REMEMBER_COOKIE]: "" }))).toBe(false);
  });
});
